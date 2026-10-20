import { initModules, MockEventBusService, moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex";
import { STOREFRONT_TRANSLATION_MODULE } from "../index";
import StorefrontTranslationModuleService from "../service";
import type {
  CountryLanguageAssignmentInput,
  MessageDocument,
} from "../../../types/storefront-translation";

jest.setTimeout(120_000);

const MODULE_PATH = "./src/modules/storefront-translation";
const messages = { Common: { title: "Title" } } satisfies MessageDocument;

function settledOf<T>(results: PromiseSettledResult<T>[]) {
  return {
    fulfilled: results.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled"),
    rejected: results.filter((r): r is PromiseRejectedResult => r.status === "rejected"),
  };
}

function typeOf(error: unknown): string | undefined {
  return error instanceof MedusaError ? error.type : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Migrations, not entity-derived schema: proves the generated migration applies.
moduleIntegrationTestRunner<StorefrontTranslationModuleService>({
  moduleName: STOREFRONT_TRANSLATION_MODULE,
  resolve: MODULE_PATH,
  pathToMigrations: `${MODULE_PATH}/migrations`,
  testSuite: ({ service, MikroOrmWrapper, dbConfig }) => {
    let other: StorefrontTranslationModuleService;
    let shutdownOther: () => Promise<void>;

    beforeEach(async () => {
      // A second module instance with its own connection pool, standing in for another server.
      const app = await initModules({
        databaseConfig: dbConfig,
        modulesConfig: {
          [STOREFRONT_TRANSLATION_MODULE]: {
            resolve: MODULE_PATH,
            options: { database: dbConfig, instance: "independent" },
          },
        },
        injectedDependencies: {
          [Modules.EVENT_BUS]: new MockEventBusService(),
          [ContainerRegistrationKeys.LOGGER]: console,
        },
      });
      other = app.medusaApp.modules[STOREFRONT_TRANSLATION_MODULE];
      shutdownOther = app.shutdown;
    });

    afterEach(async () => {
      await shutdownOther();
    });

    async function language(locale: string, active: boolean) {
      const created = await service.mutateDocument({
        operation: "import",
        input: { locale, expected_version: null, mode: "replace", messages, confirm_removed: false },
      });
      if (active) {
        await service.mutateDocument({
          operation: "activate",
          locale,
          expected_version: created.translation.version,
          is_active: true,
        });
      }
    }

    async function languageState(locale: string) {
      const [row] = await service.listStorefrontTranslations({ locale });
      return row ? { is_active: row.is_active, version: row.version } : null;
    }

    async function deactivate(target: StorefrontTranslationModuleService, locale: string, context = {}) {
      const [row] = await service.listStorefrontTranslations({ locale });
      return target.mutateDocument(
        { operation: "activate", locale, expected_version: row.version, is_active: false },
        context
      );
    }

    async function singletonCount(): Promise<number> {
      const rows = await MikroOrmWrapper.forkManager().execute<Array<{ count: string }>>(
        "SELECT count(*) AS count FROM country_language_configuration"
      );
      return Number(rows[0].count);
    }

    function assign(
      input: Partial<CountryLanguageAssignmentInput> & { country_code: string; locale: string },
      target: StorefrontTranslationModuleService = service,
      context = {}
    ) {
      return target.assignCountryLanguage(
        { expected_version: 1, configured_country_codes: ["dk", "se", "no", "es"], ...input },
        context
      );
    }

    /** Every explicitly assigned locale must be an active language. */
    async function expectAssignedLocalesActive() {
      const configuration = await service.getCountryLanguageConfiguration();
      for (const locale of new Set(Object.values(configuration?.assignments ?? {}))) {
        expect({ locale, ...(await languageState(locale)) }).toMatchObject({ locale, is_active: true });
      }
    }

    describe("bootstrap", () => {
      it("starts uninitialized and inserts version 1 without activating any language", async () => {
        await language("en", true);
        await language("da", true);
        await language("nl", false);
        expect(await service.getCountryLanguageConfiguration()).toBeNull();

        const result = await service.bootstrapCountryLanguages({ dk: "da" });

        expect(result).toEqual({ created: true, configuration: { assignments: { dk: "da" }, version: 1 } });
        expect(await other.getCountryLanguageConfiguration()).toEqual({ assignments: { dk: "da" }, version: 1 });
        expect(await languageState("nl")).toMatchObject({ is_active: false, version: 1 });
        expect(await languageState("da")).toMatchObject({ is_active: true, version: 2 });
        expect(await singletonCount()).toBe(1);
      });

      it("repeated bootstrap never overwrites the stored configuration", async () => {
        await language("en", true);
        await language("da", true);
        await language("sv", true);
        await service.bootstrapCountryLanguages({ dk: "da" });
        await assign({ country_code: "se", locale: "sv" });

        const repeated = await other.bootstrapCountryLanguages({ dk: "en", no: "en" });

        expect(repeated).toEqual({
          created: false,
          configuration: { assignments: { dk: "da", se: "sv" }, version: 2 },
        });
        expect(await service.getCountryLanguageConfiguration()).toEqual(repeated.configuration);
        expect(await singletonCount()).toBe(1);
      });

      it("concurrent bootstraps on independent instances create exactly one singleton", async () => {
        await language("en", true);
        await language("da", true);
        const { fulfilled } = settledOf(
          await Promise.allSettled([
            service.bootstrapCountryLanguages({ dk: "da" }),
            other.bootstrapCountryLanguages({ dk: "en" }),
          ])
        );
        expect(fulfilled).toHaveLength(2);
        const created = fulfilled.filter((r) => r.value.created);
        expect(created).toHaveLength(1);
        expect(await service.getCountryLanguageConfiguration()).toEqual(created[0].value.configuration);
        expect(fulfilled.map((r) => r.value.configuration)).toEqual([
          created[0].value.configuration,
          created[0].value.configuration,
        ]);
        expect(await singletonCount()).toBe(1);
      });

      it("refuses missing or inactive prerequisites, including English, without partial initialization", async () => {
        await language("en", false);
        await language("sv", false);
        await language("da", true);

        expect(await service.previewCountryLanguageBootstrap({ se: "sv", fi: "fi", dk: "da" })).toEqual({
          initialized: false,
          unavailable_locales: ["en", "fi", "sv"],
        });
        const error = await service
          .bootstrapCountryLanguages({ se: "sv", fi: "fi", dk: "da" })
          .catch((e: unknown) => e);
        expect(typeOf(error)).toBe(MedusaError.Types.CONFLICT);
        expect((error as Error).message).toContain("en, fi, sv");

        expect(await service.getCountryLanguageConfiguration()).toBeNull();
        expect(await singletonCount()).toBe(0);
        expect(await languageState("en")).toMatchObject({ is_active: false, version: 1 });
        expect(await languageState("sv")).toMatchObject({ is_active: false, version: 1 });
      });

      it("rejects non-canonical or malformed initial assignments", async () => {
        await language("en", true);
        const malformed: unknown[] = [
          { DK: "en" },
          { dnk: "en" },
          { d1: "en" },
          { dk: "EN-gb" },
          { dk: "" },
          { dk: 7 },
          ["en"],
          null,
          Object.fromEntries(Array.from({ length: 677 }, (_, i) => [`k${i}`, "en"])),
        ];
        for (const assignments of malformed) {
          await expect(
            service.bootstrapCountryLanguages(assignments as Record<string, string>)
          ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        }
        expect(await singletonCount()).toBe(0);
      });

      it("accepts a valid ninth language as an initial target", async () => {
        for (const locale of ["en", "da", "sv", "nb", "pl", "it", "fr", "de", "pt-BR"]) {
          await language(locale, true);
        }
        const result = await service.bootstrapCountryLanguages({ br: "pt-BR", dk: "da" });
        expect(result.configuration).toEqual({ assignments: { br: "pt-BR", dk: "da" }, version: 1 });
      });
    });

    describe("assignment", () => {
      beforeEach(async () => {
        await language("en", true);
        await language("da", true);
        await language("sv", true);
      });

      it("refuses a save before initialization without creating the singleton", async () => {
        await expect(assign({ country_code: "dk", locale: "da" })).rejects.toMatchObject({
          type: MedusaError.Types.CONFLICT,
        });
        expect(await singletonCount()).toBe(0);
      });

      it("returns the committed document and conflicts on a replayed expected version", async () => {
        await service.bootstrapCountryLanguages({ dk: "da" });
        const saved = await assign({ country_code: "se", locale: "sv" });
        expect(saved).toEqual({ assignments: { dk: "da", se: "sv" }, version: 2 });

        await expect(assign({ country_code: "se", locale: "sv" })).rejects.toMatchObject({
          type: MedusaError.Types.CONFLICT,
        });
        await expect(assign({ country_code: "no", locale: "en", expected_version: 3 })).rejects.toMatchObject({
          type: MedusaError.Types.CONFLICT,
        });
        expect(await service.getCountryLanguageConfiguration()).toEqual(saved);
      });

      it("accepts a ninth language and leaves other countries unchanged", async () => {
        for (const locale of ["nb", "pl", "it", "fr", "de", "es"]) {
          await language(locale, true);
        }
        await service.bootstrapCountryLanguages({ dk: "da", se: "sv" });
        expect(await assign({ country_code: "es", locale: "es" })).toEqual({
          assignments: { dk: "da", es: "es", se: "sv" },
          version: 2,
        });
      });

      it("a missing or inactive target leaves the previous document and version intact", async () => {
        await language("nl", false);
        await service.bootstrapCountryLanguages({ dk: "da" });
        for (const locale of ["nl", "fi"]) {
          await expect(assign({ country_code: "dk", locale })).rejects.toMatchObject({
            type: MedusaError.Types.CONFLICT,
          });
        }
        expect(await service.getCountryLanguageConfiguration()).toEqual({ assignments: { dk: "da" }, version: 1 });
        expect(await languageState("nl")).toMatchObject({ is_active: false, version: 1 });
      });

      it("rejects non-canonical or out-of-bounds input without a write", async () => {
        await service.bootstrapCountryLanguages({ dk: "da" });
        const invalid: Array<Parameters<typeof assign>[0]> = [
          { country_code: "DK", locale: "sv" },
          { country_code: "dnk", locale: "sv" },
          { country_code: "", locale: "sv" },
          { country_code: "dk", locale: "SV" },
          { country_code: "dk", locale: "x".repeat(65) },
          { country_code: "dk", locale: "sv", expected_version: 0 },
          { country_code: "dk", locale: "sv", expected_version: 1.5 },
          { country_code: "dk", locale: "sv", configured_country_codes: ["DK"] },
        ];
        for (const input of invalid) {
          await expect(assign(input)).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        }
        expect(await service.getCountryLanguageConfiguration()).toEqual({ assignments: { dk: "da" }, version: 1 });
      });

      it("creates only for configured countries but lets retained entries be reassigned", async () => {
        await service.bootstrapCountryLanguages({ dk: "da", gb: "sv" });

        await expect(
          assign({ country_code: "fi", locale: "sv", configured_country_codes: ["dk"] })
        ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        expect(await service.getCountryLanguageConfiguration()).toEqual({
          assignments: { dk: "da", gb: "sv" },
          version: 1,
        });

        const reassigned = await assign({ country_code: "gb", locale: "en", configured_country_codes: ["dk"] });
        expect(reassigned).toEqual({ assignments: { dk: "da", gb: "en" }, version: 2 });
      });

      it("concurrent same-version saves on independent instances produce one serial outcome", async () => {
        await service.bootstrapCountryLanguages({ dk: "da", gb: "da" });
        const { fulfilled, rejected } = settledOf(
          await Promise.allSettled([
            assign({ country_code: "dk", locale: "sv" }),
            assign({ country_code: "gb", locale: "sv", configured_country_codes: [] }, other),
          ])
        );
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(typeOf(rejected[0].reason)).toBe(MedusaError.Types.CONFLICT);
        const stored = await service.getCountryLanguageConfiguration();
        expect(stored).toEqual(fulfilled[0].value);
        expect(stored?.version).toBe(2);
        expect([{ dk: "sv", gb: "da" }, { dk: "da", gb: "sv" }]).toContainEqual(stored?.assignments);
      });
    });

    describe("deactivation integrity", () => {
      beforeEach(async () => {
        await language("en", true);
        await language("da", true);
        await language("sv", true);
      });

      it("never deactivates English, configured or not", async () => {
        await expect(deactivate(service, "en")).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        await service.bootstrapCountryLanguages({});
        await expect(deactivate(other, "en")).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        expect(await languageState("en")).toMatchObject({ is_active: true, version: 2 });
      });

      it("retained references block deactivation until explicitly reassigned", async () => {
        await service.bootstrapCountryLanguages({ se: "sv", dk: "sv", no: "da" });
        // dk has left every region but keeps its entry.
        const configured = ["se", "no"];

        const error = await deactivate(service, "sv").catch((e: unknown) => e);
        expect(typeOf(error)).toBe(MedusaError.Types.CONFLICT);
        expect((error as Error).message).toContain("countries: dk, se.");
        expect(await languageState("sv")).toMatchObject({ is_active: true, version: 2 });

        await assign({ country_code: "se", locale: "en", configured_country_codes: configured });
        const stillRetained = await deactivate(service, "sv").catch((e: unknown) => e);
        expect((stillRetained as Error).message).toContain("countries: dk.");

        await assign({ country_code: "dk", locale: "da", expected_version: 2, configured_country_codes: configured });
        const deactivated = await deactivate(other, "sv");
        expect(deactivated.translation).toMatchObject({ is_active: false, version: 3 });
        expect(await service.getCountryLanguageConfiguration()).toEqual({
          assignments: { dk: "da", no: "da", se: "en" },
          version: 3,
        });
      });

      it("assignment committed first: a waiting deactivation sees the reference and is refused", async () => {
        await service.bootstrapCountryLanguages({});
        let pending: Promise<unknown> = Promise.resolve();
        await MikroOrmWrapper.forkManager().transactional(async (manager: SqlEntityManager) => {
          await assign({ country_code: "dk", locale: "sv" }, service, { transactionManager: manager });
          pending = deactivate(other, "sv").then(
            () => "deactivated",
            (e: unknown) => e
          );
          await delay(500);
        });
        const outcome = await pending;
        expect(typeOf(outcome)).toBe(MedusaError.Types.CONFLICT);
        expect((outcome as Error).message).toContain("countries: dk.");
        expect(await service.getCountryLanguageConfiguration()).toEqual({ assignments: { dk: "sv" }, version: 2 });
        await expectAssignedLocalesActive();
      });

      it("deactivation committed first: a waiting assignment sees the inactive target and is refused", async () => {
        await service.bootstrapCountryLanguages({});
        let pending: Promise<unknown> = Promise.resolve();
        await MikroOrmWrapper.forkManager().transactional(async (manager: SqlEntityManager) => {
          await deactivate(service, "sv", { transactionManager: manager });
          pending = assign({ country_code: "dk", locale: "sv" }, other).then(
            () => "assigned",
            (e: unknown) => e
          );
          await delay(500);
        });
        const outcome = await pending;
        expect(typeOf(outcome)).toBe(MedusaError.Types.CONFLICT);
        expect(await service.getCountryLanguageConfiguration()).toEqual({ assignments: {}, version: 1 });
        expect(await languageState("sv")).toMatchObject({ is_active: false });
      });

      it("racing assignment and deactivation on independent instances keep every assigned locale active", async () => {
        await service.bootstrapCountryLanguages({ gb: "da" });
        const { fulfilled, rejected } = settledOf<unknown>(
          await Promise.allSettled([
            assign({ country_code: "dk", locale: "sv" }, service),
            deactivate(other, "sv"),
            assign({ country_code: "gb", locale: "sv", expected_version: 1, configured_country_codes: [] }, other),
          ])
        );
        expect(fulfilled.length).toBeGreaterThanOrEqual(1);
        for (const failure of rejected) {
          expect(typeOf(failure.reason)).toBe(MedusaError.Types.CONFLICT);
        }
        await expectAssignedLocalesActive();
      });

      it("a lock timeout and rollback leave no leaked lock and allow a later save", async () => {
        await service.bootstrapCountryLanguages({ dk: "da" });
        const holder = MikroOrmWrapper.forkManager().transactional(async (manager: SqlEntityManager) => {
          await assign({ country_code: "dk", locale: "sv" }, service, { transactionManager: manager });
          const timedOut = await assign({ country_code: "se", locale: "sv" }, other).catch((e: unknown) => e);
          expect(typeOf(timedOut)).toBe(MedusaError.Types.CONFLICT);
          expect((timedOut as Error).message).toContain("being changed by someone else");
          throw new Error("roll back the holder");
        });
        await expect(holder).rejects.toThrow("roll back the holder");

        expect(await service.getCountryLanguageConfiguration()).toEqual({ assignments: { dk: "da" }, version: 1 });
        expect(await assign({ country_code: "se", locale: "sv" }, other)).toEqual({
          assignments: { dk: "da", se: "sv" },
          version: 2,
        });
        expect((await deactivate(service, "da").catch((e: unknown) => e)) as Error).toMatchObject({
          type: MedusaError.Types.CONFLICT,
        });
      });

      it("the bounded lock wait does not carry into the rest of a caller's transaction", async () => {
        await service.bootstrapCountryLanguages({});
        const settings = await MikroOrmWrapper.forkManager().transactional(async (manager: SqlEntityManager) => {
          await manager.execute("SET LOCAL lock_timeout = '17s'");
          await assign({ country_code: "dk", locale: "sv" }, service, { transactionManager: manager });
          await deactivate(service, "da", { transactionManager: manager });
          return manager.execute<Array<{ lock_timeout: string }>>("SHOW lock_timeout");
        });
        expect(settings[0].lock_timeout).toBe("17s");
      });
    });

    describe("reads", () => {
      beforeEach(async () => {
        await language("en", true);
        await language("da", true);
        await language("sv", true);
        await language("nl", false);
      });

      it("refuses publication while uninitialized", async () => {
        await expect(service.publishCountryLanguages(["dk"])).rejects.toMatchObject({
          type: MedusaError.Types.UNEXPECTED_STATE,
        });
        await expect(service.getCountryLanguageManagement(["dk"])).rejects.toMatchObject({
          type: MedusaError.Types.UNEXPECTED_STATE,
        });
      });

      it("publishes configured countries only, with explicit or default source", async () => {
        await service.bootstrapCountryLanguages({ dk: "da", gb: "sv" });
        expect(await service.publishCountryLanguages(["se", "dk", "dk", "no"])).toEqual({
          default_locale: "en",
          countries: [
            { country_code: "dk", locale: "da", source: "explicit" },
            { country_code: "no", locale: "en", source: "default" },
            { country_code: "se", locale: "en", source: "default" },
          ],
        });
        // A re-added country reuses its retained entry.
        expect((await service.publishCountryLanguages(["gb"])).countries).toEqual([
          { country_code: "gb", locale: "sv", source: "explicit" },
        ]);
      });

      it("lists retained entries and active languages for management", async () => {
        await service.bootstrapCountryLanguages({ dk: "da", gb: "sv" });
        expect(await service.getCountryLanguageManagement(["se", "dk"])).toEqual({
          version: 1,
          default_locale: "en",
          countries: [
            { country_code: "dk", locale: "da", source: "explicit", configured: true },
            { country_code: "gb", locale: "sv", source: "explicit", configured: false },
            { country_code: "se", locale: "en", source: "default", configured: true },
          ],
          active_locales: ["da", "en", "sv"],
        });
      });

      it("fails publication closed when a published target or English is not active", async () => {
        await service.bootstrapCountryLanguages({ dk: "da", gb: "sv" });
        const [sv] = await service.listStorefrontTranslations({ locale: "sv" });
        // Simulated drift outside the guarded mutation path.
        await service.updateStorefrontTranslations({ id: sv.id, is_active: false });

        expect((await service.publishCountryLanguages(["dk"])).countries).toHaveLength(1);
        await expect(service.publishCountryLanguages(["dk", "gb"])).rejects.toMatchObject({
          type: MedusaError.Types.UNEXPECTED_STATE,
        });
        const [en] = await service.listStorefrontTranslations({ locale: "en" });
        await service.updateStorefrontTranslations({ id: en.id, is_active: false });
        await expect(service.publishCountryLanguages(["dk"])).rejects.toMatchObject({
          type: MedusaError.Types.UNEXPECTED_STATE,
        });
        expect((await service.getCountryLanguageManagement(["dk"])).version).toBe(1);
      });
    });
  },
});
