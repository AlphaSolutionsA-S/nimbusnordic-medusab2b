import {
  generateEntityId,
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils";
import type { Context } from "@medusajs/framework/types";
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex";
import { StorefrontTranslation } from "./models/storefront-translation";
import { TranslationMissingKey } from "./models/translation-missing-key";
import type {
  CreateInput,
  ImportInput,
  MessageDocument,
  MissingReport,
  MutationInput,
  MutationResult,
  PreviewResponse,
  TranslationDocument,
} from "../../types/storefront-translation";
import {
  diffMessages,
  flattenMessages,
  mergeMessages,
  MessageDocumentError,
  sameStructure,
  unflattenMessages,
} from "../../utils/translations/documents";
import { compareIcu } from "../../utils/translations/icu";
import {
  documentProblem,
  keyPathProblem,
  LOCALE_UNAVAILABLE_KEY,
  MAX_REPORT_PATH_LENGTH,
  MAX_REPORTS_GLOBAL,
  MAX_REPORTS_PER_LOCALE,
} from "../../utils/translations/validation";

export const REFERENCE_LOCALE = "en";

const LOCK_NAMESPACE = "storefront-translation";
const REPORTING_CAP_LOCK = `${LOCK_NAMESPACE}:reporting-cap`;
const MAX_COUNT = 2147483647;

const TRANSLATION_COLUMNS = "id, locale, messages, version, is_active, updated_at";

interface TranslationRow {
  id: string;
  locale: string;
  messages: MessageDocument;
  version: number;
  is_active: boolean;
  updated_at: Date | string;
}

interface MissingRow {
  id: string;
  key: string;
  dismissed: boolean;
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function toTranslationDocument(row: TranslationRow): TranslationDocument {
  return {
    id: row.id,
    locale: row.locale,
    messages: row.messages,
    version: Number(row.version),
    is_active: row.is_active,
    updated_at: toIso(row.updated_at),
  };
}

function conflict(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.CONFLICT, message);
}

function invalid(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message);
}

function notFound(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.NOT_FOUND, message);
}

function assertValidDocument(messages: unknown): asserts messages is MessageDocument {
  const problem = documentProblem(messages);
  if (problem) {
    throw invalid(problem);
  }
}

function applyDocumentHelper<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof MessageDocumentError) {
      throw invalid(error.message);
    }
    throw error;
  }
}

function filledKeys(messages: MessageDocument): string[] {
  return Object.entries(flattenMessages(messages))
    .filter(([, value]) => value.trim() !== "")
    .map(([key]) => key);
}

function valueAt(messages: MessageDocument, key: string): string | undefined {
  const flat = flattenMessages(messages);
  return Object.prototype.hasOwnProperty.call(flat, key) ? flat[key] : undefined;
}

function transactionManagerOf(context: Context<SqlEntityManager>): SqlEntityManager {
  const manager = context.transactionManager;
  if (!manager) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Missing transaction manager");
  }
  return manager;
}

export default class StorefrontTranslationModuleService extends MedusaService({
  StorefrontTranslation,
  TranslationMissingKey,
}) {

  private async lock(manager: SqlEntityManager, name: string): Promise<void> {
    await manager.execute("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [name]);
  }

  private async lockLocale(manager: SqlEntityManager, locale: string): Promise<void> {
    await this.lock(manager, `${LOCK_NAMESPACE}:locale:${locale}`);
  }

  private async findRow(manager: SqlEntityManager, locale: string): Promise<TranslationRow | null> {
    const rows = await manager.execute<TranslationRow[]>(
      `SELECT ${TRANSLATION_COLUMNS} FROM storefront_translation WHERE locale = ? AND deleted_at IS NULL`,
      [locale]
    );
    return rows[0] ?? null;
  }

  private async requireCurrent(
    manager: SqlEntityManager,
    locale: string,
    expectedVersion: number
  ): Promise<TranslationRow> {
    const row = await this.findRow(manager, locale);
    if (!row) {
      throw notFound(`Language "${locale}" was not found`);
    }
    if (Number(row.version) !== expectedVersion) {
      throw conflict("This language was changed by someone else. Reload it and try again.");
    }
    return row;
  }

  private async insertRow(
    manager: SqlEntityManager,
    locale: string,
    messages: MessageDocument
  ): Promise<TranslationRow> {
    const rows = await manager.execute<TranslationRow[]>(
      `INSERT INTO storefront_translation (id, locale, messages, version, is_active)
       VALUES (?, ?, CAST(? AS jsonb), 1, false)
       ON CONFLICT (locale) WHERE deleted_at IS NULL DO NOTHING
       RETURNING ${TRANSLATION_COLUMNS}`,
      [generateEntityId(undefined, "sftr"), locale, JSON.stringify(messages)]
    );
    if (!rows[0]) {
      throw conflict(`Language "${locale}" already exists`);
    }
    return rows[0];
  }

  private async compareAndSwapMessages(
    manager: SqlEntityManager,
    locale: string,
    expectedVersion: number,
    messages: MessageDocument
  ): Promise<TranslationRow> {
    const rows = await manager.execute<TranslationRow[]>(
      `UPDATE storefront_translation
       SET messages = CAST(? AS jsonb), version = version + 1, updated_at = now()
       WHERE locale = ? AND version = ? AND deleted_at IS NULL
       RETURNING ${TRANSLATION_COLUMNS}`,
      [JSON.stringify(messages), locale, expectedVersion]
    );
    if (!rows[0]) {
      throw conflict("This language was changed by someone else. Reload it and try again.");
    }
    return rows[0];
  }

  private async compareAndSwapActive(
    manager: SqlEntityManager,
    locale: string,
    expectedVersion: number,
    isActive: boolean
  ): Promise<TranslationRow> {
    const rows = await manager.execute<TranslationRow[]>(
      `UPDATE storefront_translation
       SET is_active = ?, version = version + 1, updated_at = now()
       WHERE locale = ? AND version = ? AND deleted_at IS NULL
       RETURNING ${TRANSLATION_COLUMNS}`,
      [isActive, locale, expectedVersion]
    );
    if (!rows[0]) {
      throw conflict("This language was changed by someone else. Reload it and try again.");
    }
    return rows[0];
  }

  private async clearResolved(
    manager: SqlEntityManager,
    row: TranslationRow,
    clearOutage: boolean
  ): Promise<void> {
    await manager.execute(
      `DELETE FROM translation_missing_key
       WHERE locale = ? AND key IN (SELECT jsonb_array_elements_text(CAST(? AS jsonb)))`,
      [row.locale, JSON.stringify(filledKeys(row.messages))]
    );
    if (clearOutage) {
      await manager.execute("DELETE FROM translation_missing_key WHERE locale = ? AND key = ?", [
        row.locale,
        LOCALE_UNAVAILABLE_KEY,
      ]);
    }
  }

  private async referenceFor(
    manager: SqlEntityManager,
    row: TranslationRow
  ): Promise<MessageDocument | null> {
    if (row.locale === REFERENCE_LOCALE) {
      return row.messages;
    }
    return (await this.findRow(manager, REFERENCE_LOCALE))?.messages ?? null;
  }

  private async create(manager: SqlEntityManager, input: CreateInput): Promise<TranslationRow> {
    let messages: MessageDocument;
    if (input.source === "copy") {
      // Consistent snapshot read of the source; only the target locale is locked.
      const source = await this.findRow(manager, input.source_locale);
      if (!source) {
        throw notFound(`Language "${input.source_locale}" was not found`);
      }
      if (Number(source.version) !== input.source_version) {
        throw conflict("The source language was changed by someone else. Reload it and try again.");
      }
      messages = source.messages;
    } else {
      messages = input.messages;
    }
    assertValidDocument(messages);
    await this.lockLocale(manager, input.locale);
    return this.insertRow(manager, input.locale, messages);
  }

  private async import(manager: SqlEntityManager, input: ImportInput): Promise<TranslationRow> {
    await this.lockLocale(manager, input.locale);
    assertValidDocument(input.messages);
    if (input.expected_version === null) {
      if (await this.findRow(manager, input.locale)) {
        throw conflict(`Language "${input.locale}" already exists. Reload it and preview again.`);
      }
      return this.insertRow(manager, input.locale, input.messages);
    }
    const current = await this.requireCurrent(manager, input.locale, input.expected_version);
    const next = input.mode === "merge"
      ? applyDocumentHelper(() => mergeMessages(current.messages, input.messages))
      : input.messages;
    assertValidDocument(next);
    if (diffMessages(current.messages, next).removed.length && !input.confirm_removed) {
      throw invalid("This import removes texts. Confirm the removal to apply it.");
    }
    return this.compareAndSwapMessages(manager, input.locale, input.expected_version, next);
  }

  private async resolve(
    manager: SqlEntityManager,
    locale: string,
    expectedVersion: number,
    missingId: string,
    value: string
  ): Promise<TranslationRow> {
    await this.lockLocale(manager, locale);
    const current = await this.requireCurrent(manager, locale, expectedVersion);
    const missing = await manager.execute<MissingRow[]>(
      `SELECT id, key, dismissed FROM translation_missing_key
       WHERE id = ? AND locale = ? AND deleted_at IS NULL`,
      [missingId, locale]
    );
    const record = missing[0];
    if (!record) {
      throw notFound("Missing text report was not found");
    }
    if (record.key === LOCALE_UNAVAILABLE_KEY || keyPathProblem(record.key)) {
      throw invalid("This report is not a text key. Import or activate the language instead.");
    }
    if ((valueAt(current.messages, record.key) ?? "").trim() !== "") {
      throw conflict("This text already has a value. Reload the language.");
    }
    const next = applyDocumentHelper(() =>
      mergeMessages(current.messages, unflattenMessages({ [record.key]: value }))
    );
    assertValidDocument(next);
    return this.compareAndSwapMessages(manager, locale, expectedVersion, next);
  }

  /** Read-only: recomputes the proposed document at the caller's loaded version. */
  async previewImport(input: Omit<ImportInput, "confirm_removed">): Promise<PreviewResponse> {
    assertValidDocument(input.messages);
    const [current] = await this.listStorefrontTranslations(
      { locale: input.locale },
      { select: ["locale", "messages", "version"] }
    );
    if (input.expected_version === null ? current : !current) {
      throw current
        ? conflict(`Language "${input.locale}" already exists. Reload it and preview again.`)
        : notFound(`Language "${input.locale}" was not found`);
    }
    if (current && Number(current.version) !== input.expected_version) {
      throw conflict("This language was changed by someone else. Reload it and try again.");
    }
    const existing = (current?.messages ?? {}) as MessageDocument;
    const next = current && input.mode === "merge"
      ? applyDocumentHelper(() => mergeMessages(existing, input.messages))
      : input.messages;
    assertValidDocument(next);
    const [reference] = input.locale === REFERENCE_LOCALE
      ? [{ messages: next }]
      : await this.listStorefrontTranslations(
          { locale: REFERENCE_LOCALE },
          { select: ["messages"] }
        );
    return {
      locale: input.locale,
      expected_version: input.expected_version,
      mode: input.mode,
      diff: diffMessages(existing, next),
      warnings: compareIcu(next, (reference?.messages as MessageDocument | undefined) ?? null),
    };
  }

  @InjectManager()
  async mutateDocument(
    input: MutationInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<MutationResult> {
    return this.mutateDocument_(input, context);
  }

  @InjectTransactionManager()
  protected async mutateDocument_(
    input: MutationInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<MutationResult> {
    const manager = transactionManagerOf(context);
    let row: TranslationRow;
    let clearOutage = false;
    switch (input.operation) {
      case "create":
        row = await this.create(manager, input.input);
        clearOutage = true;
        break;
      case "import":
        row = await this.import(manager, input.input);
        clearOutage = true;
        break;
      case "save": {
        await this.lockLocale(manager, input.locale);
        const current = await this.requireCurrent(manager, input.locale, input.expected_version);
        assertValidDocument(input.messages);
        if (!sameStructure(current.messages, input.messages)) {
          throw invalid("Editing can only change existing texts. Use import to add or remove keys.");
        }
        row = await this.compareAndSwapMessages(
          manager,
          input.locale,
          input.expected_version,
          input.messages
        );
        break;
      }
      case "activate":
        await this.lockLocale(manager, input.locale);
        await this.requireCurrent(manager, input.locale, input.expected_version);
        row = await this.compareAndSwapActive(
          manager,
          input.locale,
          input.expected_version,
          input.is_active
        );
        clearOutage = input.is_active;
        break;
      case "resolve":
        row = await this.resolve(
          manager,
          input.locale,
          input.expected_version,
          input.missing_id,
          input.value
        );
        break;
    }
    await this.clearResolved(manager, row, clearOutage);
    return {
      translation: toTranslationDocument(row),
      warnings: compareIcu(row.messages, await this.referenceFor(manager, row)),
    };
  }

  @InjectManager()
  async reportMissing(
    reports: MissingReport[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ accepted: number; ignored: number }> {
    return this.reportMissing_(reports, context);
  }

  @InjectTransactionManager()
  protected async reportMissing_(
    reports: MissingReport[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ accepted: number; ignored: number }> {
    const manager = transactionManagerOf(context);
    await this.lock(manager, REPORTING_CAP_LOCK);
    const locales = [...new Set(reports.map((report) => report.locale))].sort();
    const documents = new Map<string, MessageDocument | null>();
    const activeLocales = new Set<string>();
    for (const locale of locales) {
      await this.lockLocale(manager, locale);
      const row = await this.findRow(manager, locale);
      documents.set(locale, row?.messages ?? null);
      if (row?.is_active) {
        activeLocales.add(locale);
      }
    }

    let accepted = 0;
    for (const report of reports) {
      const key = report.kind === "key" ? report.key : LOCALE_UNAVAILABLE_KEY;
      // An outage report for a locale that is active now comes from a storefront worker still
      // holding an older inactive/absent state; recording it would show a stale notice.
      if (report.kind === "locale_unavailable" && activeLocales.has(report.locale)) {
        continue;
      }
      if (report.kind === "key") {
        const document = documents.get(report.locale);
        // Individual keys only for provisioned locales, and only while still absent or empty.
        if (!document || keyPathProblem(key) || (valueAt(document, key) ?? "").trim() !== "") {
          continue;
        }
      }
      const pagePath = report.page_path.slice(0, MAX_REPORT_PATH_LENGTH);
      const existing = await manager.execute<MissingRow[]>(
        `SELECT id, key, dismissed FROM translation_missing_key
         WHERE locale = ? AND key = ? AND deleted_at IS NULL`,
        [report.locale, key]
      );
      if (existing[0]) {
        if (existing[0].dismissed) {
          continue;
        }
        await manager.execute(
          `UPDATE translation_missing_key
           SET count = LEAST(count::bigint + 1, ?)::integer, last_seen_at = now(),
               last_page_path = ?, updated_at = now()
           WHERE id = ?`,
          [MAX_COUNT, pagePath, existing[0].id]
        );
        accepted += 1;
        continue;
      }
      const [{ locale_count, global_count }] = await manager.execute<
        Array<{ locale_count: string | number; global_count: string | number }>
      >(
        `SELECT
           (SELECT count(*) FROM translation_missing_key WHERE locale = ? AND deleted_at IS NULL) AS locale_count,
           (SELECT count(*) FROM translation_missing_key WHERE deleted_at IS NULL) AS global_count`,
        [report.locale]
      );
      if (Number(locale_count) >= MAX_REPORTS_PER_LOCALE || Number(global_count) >= MAX_REPORTS_GLOBAL) {
        continue;
      }
      await manager.execute(
        `INSERT INTO translation_missing_key
           (id, locale, key, count, first_seen_at, last_seen_at, last_page_path, dismissed)
         VALUES (?, ?, ?, 1, now(), now(), ?, false)`,
        [generateEntityId(undefined, "trmk"), report.locale, key, pagePath]
      );
      accepted += 1;
    }
    return { accepted, ignored: reports.length - accepted };
  }

  @InjectManager()
  async dismissMissing(
    locale: string,
    id: string,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<void> {
    return this.dismissMissing_(locale, id, context);
  }

  @InjectTransactionManager()
  protected async dismissMissing_(
    locale: string,
    id: string,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = transactionManagerOf(context);
    await this.lockLocale(manager, locale);
    const rows = await manager.execute<Array<{ id: string }>>(
      `UPDATE translation_missing_key SET dismissed = true, updated_at = now()
       WHERE id = ? AND locale = ? AND deleted_at IS NULL
       RETURNING id`,
      [id, locale]
    );
    if (!rows[0]) {
      throw notFound("Missing text report was not found");
    }
  }
}
