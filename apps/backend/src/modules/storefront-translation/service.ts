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
  CountryLanguageAssignmentInput,
  CountryLanguageAssignments,
  CountryLanguageBootstrapReport,
  CountryLanguageBootstrapResult,
  CountryLanguageConfiguration,
  CountryLanguageManagement,
  CountryLanguagePublication,
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
  assignmentsProblem,
  countriesUsing,
  DEFAULT_COUNTRY_LOCALE,
  effectiveCountryLanguages,
  isCanonicalLocale,
  isCountryCode,
  MAX_CONFIGURATION_BYTES,
  serializedAssignments,
} from "./country-languages";
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
// Taken before any locale lock by bootstrap, assignment saves and activation changes, so an
// assignment and a deactivation never commit against each other's stale view (NIMBUS-176).
const CONFIGURATION_LOCK = `${LOCK_NAMESPACE}:country-language-configuration`;
const CONFIGURATION_ID = "country_language_configuration";
const CONFIGURATION_LOCK_TIMEOUT = "5s";
const LOCK_NOT_AVAILABLE = "55P03";
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

interface CommittedMutation {
  row: TranslationRow;
  reference: MessageDocument | null;
}

interface MissingRow {
  id: string;
  key: string;
  dismissed: boolean;
}

interface ConfigurationRow {
  assignments: CountryLanguageAssignments;
  version: number;
}

interface ConfigurationSnapshotRow extends ConfigurationRow {
  active_locales: string[];
}

function toConfiguration(row: ConfigurationRow): CountryLanguageConfiguration {
  return { assignments: row.assignments, version: Number(row.version) };
}

function unavailable(): MedusaError {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Country languages are not available");
}

function isLockTimeout(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === LOCK_NOT_AVAILABLE;
}

async function failFastOnBusyLock<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isLockTimeout(error)) {
      throw conflict("Country languages are being changed by someone else. Try again.");
    }
    throw error;
  }
}

function assertValidAssignments(value: unknown): asserts value is CountryLanguageAssignments {
  const problem = assignmentsProblem(value);
  if (problem) {
    throw invalid(problem);
  }
}

function assertValidCountryCodes(codes: unknown): asserts codes is string[] {
  if (!Array.isArray(codes) || !codes.every(isCountryCode)) {
    throw invalid("Configured country codes must be two lowercase letters");
  }
}

function assertValidAssignmentInput(input: CountryLanguageAssignmentInput): void {
  if (!isCountryCode(input.country_code)) {
    throw invalid("Country code must be two lowercase letters");
  }
  if (!isCanonicalLocale(input.locale)) {
    throw invalid("Language must be a canonical BCP 47 language tag");
  }
  if (!Number.isInteger(input.expected_version) || input.expected_version < 1) {
    throw invalid("Expected version must be a positive integer");
  }
  assertValidCountryCodes(input.configured_country_codes);
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

/**
 * True when the key can never become a text: a proper prefix of its path is a text, or the
 * key itself is an existing group.
 */
function clashesWithDocument(messages: MessageDocument, key: string): boolean {
  const segments = key.split(".");
  let node: MessageDocument = messages;
  for (const [index, segment] of segments.entries()) {
    if (!Object.prototype.hasOwnProperty.call(node, segment)) {
      return false;
    }
    const child = node[segment];
    if (typeof child === "string") {
      return index < segments.length - 1;
    }
    if (index === segments.length - 1) {
      return true;
    }
    node = child;
  }
  return false;
}

function transactionManagerOf(context: Context<SqlEntityManager>): SqlEntityManager {
  const manager = context.transactionManager;
  if (!manager) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Missing transaction manager");
  }
  return manager;
}

function managerOf(context: Context<SqlEntityManager>): SqlEntityManager {
  const manager = context.transactionManager ?? context.manager;
  if (!manager) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Missing manager");
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

  /**
   * Bounded wait: a stuck holder fails this transaction instead of queueing Admin requests. The
   * caller's own lock_timeout is restored afterwards, because a transaction passed in by a
   * workflow keeps running other statements after this lock.
   */
  private async lockConfiguration(manager: SqlEntityManager): Promise<void> {
    const [previous] = await manager.execute<Array<{ lock_timeout: string }>>(
      "SELECT current_setting('lock_timeout') AS lock_timeout"
    );
    await manager.execute("SELECT set_config('lock_timeout', ?, true)", [CONFIGURATION_LOCK_TIMEOUT]);
    await this.lock(manager, CONFIGURATION_LOCK);
    await manager.execute("SELECT set_config('lock_timeout', ?, true)", [previous.lock_timeout]);
  }

  private async findConfiguration(manager: SqlEntityManager): Promise<ConfigurationRow | null> {
    const rows = await manager.execute<ConfigurationRow[]>(
      `SELECT assignments, version FROM country_language_configuration
       WHERE id = ? AND deleted_at IS NULL`,
      [CONFIGURATION_ID]
    );
    return rows[0] ?? null;
  }

  /** Configuration and active languages from one statement, hence one consistent snapshot. */
  private async findConfigurationSnapshot(
    manager: SqlEntityManager
  ): Promise<ConfigurationSnapshotRow | null> {
    const rows = await manager.execute<ConfigurationSnapshotRow[]>(
      `SELECT c.assignments, c.version,
         (SELECT coalesce(jsonb_agg(t.locale ORDER BY t.locale), '[]'::jsonb)
          FROM storefront_translation t
          WHERE t.is_active AND t.deleted_at IS NULL) AS active_locales
       FROM country_language_configuration c
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [CONFIGURATION_ID]
    );
    return rows[0] ?? null;
  }

  /** The given locales that are missing or inactive, sorted and unique. */
  private async unavailableLocales(manager: SqlEntityManager, locales: string[]): Promise<string[]> {
    const wanted = [...new Set(locales)].sort();
    const rows = await manager.execute<Array<{ locale: string }>>(
      `SELECT locale FROM storefront_translation
       WHERE is_active AND deleted_at IS NULL
         AND locale IN (SELECT jsonb_array_elements_text(CAST(? AS jsonb)))`,
      [JSON.stringify(wanted)]
    );
    const active = new Set(rows.map((row) => row.locale));
    return wanted.filter((locale) => !active.has(locale));
  }

  /** Caller holds the configuration lock, so no assignment can commit until this transaction ends. */
  private async assertDeactivatable(manager: SqlEntityManager, locale: string): Promise<void> {
    if (locale === DEFAULT_COUNTRY_LOCALE) {
      throw conflict("English is the default storefront language and cannot be deactivated.");
    }
    const configuration = await this.findConfiguration(manager);
    const countries = countriesUsing(configuration?.assignments ?? {}, locale);
    if (countries.length) {
      throw conflict(
        `Language "${locale}" is still assigned to countries: ${countries.join(", ")}. ` +
          "Reassign them before deactivating it."
      );
    }
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
    const { row, reference } = await failFastOnBusyLock(() => this.mutateDocument_(input, context));
    // ICU parsing runs after the commit so the locale lock is not held while it runs.
    return {
      translation: toTranslationDocument(row),
      warnings: compareIcu(row.messages, reference),
    };
  }

  @InjectTransactionManager()
  protected async mutateDocument_(
    input: MutationInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CommittedMutation> {
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
        await this.lockConfiguration(manager);
        await this.lockLocale(manager, input.locale);
        await this.requireCurrent(manager, input.locale, input.expected_version);
        if (!input.is_active) {
          await this.assertDeactivatable(manager, input.locale);
        }
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
    return { row, reference: await this.referenceFor(manager, row) };
  }

  /** The stored document, or null while uninitialized. */
  @InjectManager()
  async getCountryLanguageConfiguration(
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageConfiguration | null> {
    const row = await this.findConfiguration(managerOf(context));
    return row ? toConfiguration(row) : null;
  }

  /** Read-only bootstrap prerequisites: English plus every target must exist and be active. */
  @InjectManager()
  async previewCountryLanguageBootstrap(
    assignments: CountryLanguageAssignments,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageBootstrapReport> {
    assertValidAssignments(assignments);
    const manager = managerOf(context);
    return {
      initialized: (await this.findConfiguration(manager)) !== null,
      unavailable_locales: await this.unavailableLocales(manager, [
        DEFAULT_COUNTRY_LOCALE,
        ...Object.values(assignments),
      ]),
    };
  }

  /**
   * Inserts the version-1 document only when none exists; an existing document is returned
   * unchanged. Never activates a language.
   */
  @InjectManager()
  async bootstrapCountryLanguages(
    assignments: CountryLanguageAssignments,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageBootstrapResult> {
    return failFastOnBusyLock(() => this.bootstrapCountryLanguages_(assignments, context));
  }

  @InjectTransactionManager()
  protected async bootstrapCountryLanguages_(
    assignments: CountryLanguageAssignments,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageBootstrapResult> {
    assertValidAssignments(assignments);
    const manager = transactionManagerOf(context);
    await this.lockConfiguration(manager);
    const existing = await this.findConfiguration(manager);
    if (existing) {
      return { created: false, configuration: toConfiguration(existing) };
    }
    const missing = await this.unavailableLocales(manager, [
      DEFAULT_COUNTRY_LOCALE,
      ...Object.values(assignments),
    ]);
    if (missing.length) {
      throw conflict(
        `Activate these languages before initializing country languages: ${missing.join(", ")}.`
      );
    }
    const rows = await manager.execute<ConfigurationRow[]>(
      `INSERT INTO country_language_configuration (id, assignments, version)
       VALUES (?, CAST(? AS jsonb), 1)
       ON CONFLICT (id) DO NOTHING
       RETURNING assignments, version`,
      [CONFIGURATION_ID, serializedAssignments(assignments)]
    );
    if (!rows[0]) {
      throw conflict("Country languages could not be initialized because a removed configuration exists.");
    }
    return { created: true, configuration: toConfiguration(rows[0]) };
  }

  /**
   * Sets one country's explicit language at the caller's loaded version. A new key needs a
   * configured country; a retained key (country left every region) may only be reassigned.
   */
  @InjectManager()
  async assignCountryLanguage(
    input: CountryLanguageAssignmentInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageConfiguration> {
    return failFastOnBusyLock(() => this.assignCountryLanguage_(input, context));
  }

  @InjectTransactionManager()
  protected async assignCountryLanguage_(
    input: CountryLanguageAssignmentInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageConfiguration> {
    assertValidAssignmentInput(input);
    const manager = transactionManagerOf(context);
    await this.lockConfiguration(manager);
    const current = await this.findConfiguration(manager);
    if (!current) {
      throw conflict("Country languages are not initialized yet.");
    }
    if (Number(current.version) !== input.expected_version) {
      throw conflict("Country languages were changed by someone else. Reload them and try again.");
    }
    const hasEntry = Object.prototype.hasOwnProperty.call(current.assignments, input.country_code);
    if (!hasEntry && !input.configured_country_codes.includes(input.country_code)) {
      throw invalid(`Country "${input.country_code}" is not part of any region.`);
    }
    if ((await this.unavailableLocales(manager, [input.locale])).length) {
      throw conflict(`Language "${input.locale}" is not an active language.`);
    }
    const next = serializedAssignments({ ...current.assignments, [input.country_code]: input.locale });
    if (Buffer.byteLength(next) > MAX_CONFIGURATION_BYTES) {
      throw invalid("Assignments are too large");
    }
    const rows = await manager.execute<ConfigurationRow[]>(
      `UPDATE country_language_configuration
       SET assignments = CAST(? AS jsonb), version = version + 1, updated_at = now()
       WHERE id = ? AND version = ? AND deleted_at IS NULL
       RETURNING assignments, version`,
      [next, CONFIGURATION_ID, input.expected_version]
    );
    if (!rows[0]) {
      throw conflict("Country languages were changed by someone else. Reload them and try again.");
    }
    return toConfiguration(rows[0]);
  }

  /** Configured and retained entries for Admin; does not require the publication invariant. */
  @InjectManager()
  async getCountryLanguageManagement(
    configuredCountryCodes: string[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguageManagement> {
    assertValidCountryCodes(configuredCountryCodes);
    const snapshot = await this.findConfigurationSnapshot(managerOf(context));
    if (!snapshot) {
      throw unavailable();
    }
    const configured = new Set(configuredCountryCodes);
    const codes = [...new Set([...configuredCountryCodes, ...Object.keys(snapshot.assignments)])];
    return {
      version: Number(snapshot.version),
      default_locale: DEFAULT_COUNTRY_LOCALE,
      countries: effectiveCountryLanguages(snapshot.assignments, codes).map((entry) => ({
        ...entry,
        configured: configured.has(entry.country_code),
      })),
      active_locales: snapshot.active_locales,
    };
  }

  /**
   * Effective language per configured country. Fails closed while uninitialized or when English
   * or a published target is not active, so callers keep their previous publication instead.
   */
  @InjectManager()
  async publishCountryLanguages(
    configuredCountryCodes: string[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<CountryLanguagePublication> {
    assertValidCountryCodes(configuredCountryCodes);
    const snapshot = await this.findConfigurationSnapshot(managerOf(context));
    if (!snapshot) {
      throw unavailable();
    }
    const countries = effectiveCountryLanguages(snapshot.assignments, configuredCountryCodes);
    const active = new Set(snapshot.active_locales);
    if (!active.has(DEFAULT_COUNTRY_LOCALE) || countries.some((entry) => !active.has(entry.locale))) {
      throw unavailable();
    }
    return { default_locale: DEFAULT_COUNTRY_LOCALE, countries };
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
        // A key below an existing text, or naming an existing group, can never be resolved.
        if (
          !document ||
          keyPathProblem(key) ||
          (valueAt(document, key) ?? "").trim() !== "" ||
          clashesWithDocument(document, key)
        ) {
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
