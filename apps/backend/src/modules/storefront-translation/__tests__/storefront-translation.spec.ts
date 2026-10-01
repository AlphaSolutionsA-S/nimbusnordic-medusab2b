import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaError } from "@medusajs/framework/utils";
import { STOREFRONT_TRANSLATION_MODULE } from "../index";
import StorefrontTranslationModuleService from "../service";
import type { MessageDocument } from "../../../types/storefront-translation";
import { MAX_REPORTS_GLOBAL } from "../../../utils/translations/validation";

jest.setTimeout(60_000);

const english = {
  Common: { title: "Welcome {name}", empty: "", group: {} },
  Cart: { title: "Cart" },
} satisfies MessageDocument;

type EnglishShape = typeof english;

function conflictOf(error: unknown): boolean {
  return error instanceof MedusaError && error.type === MedusaError.Types.CONFLICT;
}

moduleIntegrationTestRunner<StorefrontTranslationModuleService>({
  moduleName: STOREFRONT_TRANSLATION_MODULE,
  resolve: "./src/modules/storefront-translation",
  testSuite: ({ service }) => {
    async function importLocale(locale: string, messages: MessageDocument = english) {
      return service.mutateDocument({
        operation: "import",
        input: { locale, expected_version: null, mode: "replace", messages, confirm_removed: false },
      });
    }

    describe("StorefrontTranslationModuleService", () => {
      it("TC-1: creates inactive version-1 languages by import and copy", async () => {
        const created = await importLocale("en");
        expect(created.translation).toMatchObject({ locale: "en", version: 1, is_active: false });
        expect(created.translation.messages).toEqual(english);
        expect(created.translation.id).toMatch(/^sftr_/);

        const copy = await service.mutateDocument({
          operation: "create",
          input: { locale: "nl", source: "copy", source_locale: "en", source_version: 1 },
        });
        expect(copy.translation).toMatchObject({ locale: "nl", version: 1, is_active: false });
        expect(copy.translation.messages).toEqual(english);
      });

      it("TC-1: rejects duplicate creation, including simultaneous first imports", async () => {
        const results = await Promise.allSettled([importLocale("da"), importLocale("da")]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((result) => result.status === "rejected");
        expect(conflictOf((rejected as PromiseRejectedResult).reason)).toBe(true);
        await expect(
          service.mutateDocument({
            operation: "create",
            input: { locale: "da", source: "import", messages: english },
          })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        expect(await service.listStorefrontTranslations({ locale: "da" })).toHaveLength(1);
      });

      it("TC-1: rejects a stale copy source version", async () => {
        await importLocale("en");
        await expect(
          service.mutateDocument({
            operation: "create",
            input: { locale: "fi", source: "copy", source_locale: "en", source_version: 7 },
          })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
      });

      it("TC-2: exactly one of two concurrent saves at the same version wins", async () => {
        await importLocale("sv");
        const save = (title: string) =>
          service.mutateDocument({
            operation: "save",
            locale: "sv",
            expected_version: 1,
            messages: { ...english, Cart: { title } },
          });
        const results = await Promise.allSettled([save("Varukorg A"), save("Varukorg B")]);
        const fulfilled = results.filter((result) => result.status === "fulfilled");
        const rejected = results.filter((result) => result.status === "rejected");
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(conflictOf((rejected[0] as PromiseRejectedResult).reason)).toBe(true);
        const [row] = await service.listStorefrontTranslations({ locale: "sv" });
        expect(row.version).toBe(2);
        expect(["Varukorg A", "Varukorg B"]).toContain((row.messages as EnglishShape).Cart.title);
        expect(row.messages).toEqual(
          (fulfilled[0] as PromiseFulfilledResult<{ translation: { messages: MessageDocument } }>).value
            .translation.messages
        );
      });

      it("TC-2: normal save cannot add, remove, or restructure keys", async () => {
        await importLocale("sv");
        const invalidSaves: MessageDocument[] = [
          { ...english, Cart: { title: "x", added: "y" } },
          { Common: english.Common },
          { ...english, Common: { title: "x", empty: "" } },
        ];
        for (const messages of invalidSaves) {
          await expect(
            service.mutateDocument({ operation: "save", locale: "sv", expected_version: 1, messages })
          ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        }
        const [row] = await service.listStorefrontTranslations({ locale: "sv" });
        expect(row.version).toBe(1);
      });

      it("TC-3: stale import and activation conflict without partial changes or lost reports", async () => {
        await importLocale("de");
        await service.reportMissing([{ locale: "de", page_path: "/", kind: "key", key: "Common.empty" }]);
        await service.mutateDocument({
          operation: "save",
          locale: "de",
          expected_version: 1,
          messages: { ...english, Cart: { title: "Warenkorb" } },
        });
        await expect(
          service.mutateDocument({
            operation: "import",
            input: {
              locale: "de",
              expected_version: 1,
              mode: "merge",
              messages: { Common: { empty: "filled" } },
              confirm_removed: false,
            },
          })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        await expect(
          service.mutateDocument({ operation: "activate", locale: "de", expected_version: 1, is_active: true })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        const [row] = await service.listStorefrontTranslations({ locale: "de" });
        expect(row).toMatchObject({ version: 2, is_active: false });
        expect((row.messages as EnglishShape).Cart.title).toBe("Warenkorb");
        expect(await service.listTranslationMissingKeys({ locale: "de" })).toHaveLength(1);
      });

      it("TC-3: replace import that removes keys requires confirmation", async () => {
        await importLocale("fr");
        const replace = (confirm: boolean) =>
          service.mutateDocument({
            operation: "import",
            input: {
              locale: "fr",
              expected_version: 1,
              mode: "replace",
              messages: { Cart: { title: "Panier" } },
              confirm_removed: confirm,
            },
          });
        await expect(replace(false)).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        const applied = await replace(true);
        expect(applied.translation).toMatchObject({ version: 2, messages: { Cart: { title: "Panier" } } });
      });

      it("TC-3: previews an import for a new locale without writing", async () => {
        await importLocale("en");
        const preview = await service.previewImport({
          locale: "sv",
          expected_version: null,
          mode: "replace",
          messages: { Cart: { title: "Varukorg" } },
        });
        expect(preview).toMatchObject({ locale: "sv", expected_version: null, mode: "replace" });
        expect(preview.diff).toEqual({ added: ["Cart.title"], changed: [], removed: [], empty: [] });
        expect(preview.warnings).toEqual([]);
        expect(await service.listStorefrontTranslations({ locale: "sv" })).toHaveLength(0);
        await expect(
          service.previewImport({ locale: "en", expected_version: null, mode: "replace", messages: english })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
      });

      it("TC-3: previews a merge into an existing locale at its loaded version", async () => {
        await importLocale("en");
        await importLocale("sv");
        const preview = await service.previewImport({
          locale: "sv",
          expected_version: 1,
          mode: "merge",
          messages: { Common: { title: "Välkommen" }, Cart: { added: "Ny" } },
        });
        expect(preview.diff).toEqual({
          added: ["Cart.added"],
          changed: ["Common.title"],
          removed: [],
          empty: ["Common.empty"],
        });
        expect(preview.warnings).toEqual([
          expect.objectContaining({ key: "Common.title", code: "arguments" }),
        ]);
        const [row] = await service.listStorefrontTranslations({ locale: "sv" });
        expect(row).toMatchObject({ version: 1, messages: english });
      });

      it("TC-3: preview rejects a stale version and a text/group merge clash", async () => {
        await importLocale("sv");
        await service.mutateDocument({
          operation: "save",
          locale: "sv",
          expected_version: 1,
          messages: { ...english, Cart: { title: "Varukorg" } },
        });
        await expect(
          service.previewImport({ locale: "sv", expected_version: 1, mode: "merge", messages: english })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        await expect(
          service.previewImport({
            locale: "sv",
            expected_version: 2,
            mode: "merge",
            messages: { Cart: { title: { sub: "x" } } },
          })
        ).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
      });

      it("TC-3: activation increments the version and clears the outage notice", async () => {
        await service.reportMissing([{ locale: "it", page_path: "/", kind: "locale_unavailable" }]);
        expect(await service.listTranslationMissingKeys({ locale: "it" })).toHaveLength(1);
        await importLocale("it");
        const activated = await service.mutateDocument({
          operation: "activate",
          locale: "it",
          expected_version: 1,
          is_active: true,
        });
        expect(activated.translation).toMatchObject({ version: 2, is_active: true });
        expect(await service.listTranslationMissingKeys({ locale: "it" })).toHaveLength(0);
      });

      it("TC-3: ignores a stale outage report for a locale that is active", async () => {
        await importLocale("it");
        await service.mutateDocument({ operation: "activate", locale: "it", expected_version: 1, is_active: true });
        const result = await service.reportMissing([{ locale: "it", page_path: "/it", kind: "locale_unavailable" }]);
        expect(result).toEqual({ accepted: 0, ignored: 1 });
        await service.mutateDocument({ operation: "activate", locale: "it", expected_version: 2, is_active: false });
        expect(
          await service.reportMissing([{ locale: "it", page_path: "/it", kind: "locale_unavailable" }])
        ).toEqual({ accepted: 1, ignored: 0 });
      });

      it("TC-4: parallel duplicate reports produce one row with correct counts", async () => {
        await importLocale("pl");
        const report = { locale: "pl", page_path: "/pl/cart", kind: "key" as const, key: "Cart.missing" };
        const results = await Promise.all([
          service.reportMissing([report, report]),
          service.reportMissing([report]),
          service.reportMissing([report]),
        ]);
        expect(results.reduce((sum, result) => sum + result.accepted, 0)).toBe(4);
        const rows = await service.listTranslationMissingKeys({ locale: "pl" });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ key: "Cart.missing", count: 4, last_page_path: "/pl/cart" });
      });

      it("TC-4: ignores filled keys and unprovisioned locales; accepts outage for unprovisioned", async () => {
        await importLocale("pl");
        const result = await service.reportMissing([
          { locale: "pl", page_path: "/", kind: "key", key: "Cart.title" },
          { locale: "xx", page_path: "/", kind: "key", key: "Cart.title" },
          { locale: "xx", page_path: "/", kind: "locale_unavailable" },
          { locale: "pl", page_path: "/", kind: "key", key: "Common.empty" },
        ]);
        expect(result).toEqual({ accepted: 2, ignored: 2 });
      });

      it("TC-4: dismissed entries stay dismissed on repeat reports", async () => {
        await importLocale("pl");
        const report = { locale: "pl", page_path: "/", kind: "key" as const, key: "Cart.gone" };
        await service.reportMissing([report]);
        const [row] = await service.listTranslationMissingKeys({ locale: "pl" });
        await service.dismissMissing("pl", row.id);
        expect(await service.reportMissing([report])).toEqual({ accepted: 0, ignored: 1 });
        const [after] = await service.listTranslationMissingKeys({ locale: "pl" });
        expect(after).toMatchObject({ dismissed: true, count: 1 });
        await expect(service.dismissMissing("sv", row.id)).rejects.toMatchObject({
          type: MedusaError.Types.NOT_FOUND,
        });
      });

      it("TC-4: enforces the per-locale cap across connections", async () => {
        await importLocale("pl");
        await service.createTranslationMissingKeys(
          Array.from({ length: 2499 }, (_, index) => ({
            locale: "pl",
            key: `Filler.k${index}`,
            first_seen_at: new Date(),
            last_seen_at: new Date(),
            last_page_path: "/",
          }))
        );
        const results = await Promise.all(
          ["A", "B", "C"].map((suffix) =>
            service.reportMissing([{ locale: "pl", page_path: "/", kind: "key", key: `Cap.${suffix}` }])
          )
        );
        expect(results.reduce((sum, result) => sum + result.accepted, 0)).toBe(1);
        const [, count] = await service.listAndCountTranslationMissingKeys({ locale: "pl" });
        expect(count).toBe(2500);
      });

      it("TC-4: enforces the global cap, counting dismissed entries", async () => {
        await importLocale("pl");
        const filler = (index: number) => ({
          locale: `x-${Math.floor(index / 2000)}`,
          key: `Filler.k${index}`,
          first_seen_at: new Date(),
          last_seen_at: new Date(),
          last_page_path: "/",
          dismissed: index % 2 === 0,
        });
        for (let start = 0; start < MAX_REPORTS_GLOBAL - 1; start += 5000) {
          const end = Math.min(start + 5000, MAX_REPORTS_GLOBAL - 1);
          await service.createTranslationMissingKeys(
            Array.from({ length: end - start }, (_, offset) => filler(start + offset))
          );
        }
        const result = await service.reportMissing([
          { locale: "pl", page_path: "/", kind: "key", key: "Global.A" },
          { locale: "pl", page_path: "/", kind: "key", key: "Global.B" },
        ]);
        expect(result).toEqual({ accepted: 1, ignored: 1 });
        const [, count] = await service.listAndCountTranslationMissingKeys({});
        expect(count).toBe(MAX_REPORTS_GLOBAL);
      });

      it("TC-4: ignores keys below an existing text or naming a group but accepts new keys and group children", async () => {
        await importLocale("pl");
        const result = await service.reportMissing([
          { locale: "pl", page_path: "/", kind: "key", key: "Cart.title.sub" },
          { locale: "pl", page_path: "/", kind: "key", key: "Cart.title.sub.deeper" },
          { locale: "pl", page_path: "/", kind: "key", key: "Cart" },
          { locale: "pl", page_path: "/", kind: "key", key: "Common.group" },
          { locale: "pl", page_path: "/", kind: "key", key: "Common.group.child" },
          { locale: "pl", page_path: "/", kind: "key", key: "Cart.newKey" },
        ]);
        expect(result).toEqual({ accepted: 2, ignored: 4 });
        const rows = await service.listTranslationMissingKeys({ locale: "pl" });
        expect(rows.map((row) => row.key).sort()).toEqual(["Cart.newKey", "Common.group.child"]);
      });

      it("TC-5: a report racing a resolution never leaves an entry for a filled key", async () => {
        await importLocale("no");
        await importLocale("da");
        await service.reportMissing([
          { locale: "no", page_path: "/", kind: "key", key: "Cart.new" },
          { locale: "da", page_path: "/", kind: "key", key: "Cart.new" },
        ]);
        const [missing] = await service.listTranslationMissingKeys({ locale: "no" });
        const [resolved] = await Promise.all([
          service.mutateDocument({
            operation: "resolve",
            locale: "no",
            expected_version: 1,
            missing_id: missing.id,
            value: "Ny",
          }),
          service.reportMissing([{ locale: "no", page_path: "/", kind: "key", key: "Cart.new" }]),
        ]);
        expect((resolved.translation.messages.Cart as MessageDocument).new).toBe("Ny");
        expect(await service.listTranslationMissingKeys({ locale: "no" })).toHaveLength(0);
        expect(await service.listTranslationMissingKeys({ locale: "da" })).toHaveLength(1);
      });

      it("TC-5: resolve refuses the outage sentinel and IDs from another locale", async () => {
        await importLocale("no");
        await importLocale("da");
        await service.reportMissing([
          { locale: "no", page_path: "/", kind: "locale_unavailable" },
          { locale: "da", page_path: "/", kind: "key", key: "Cart.other" },
        ]);
        const [outage] = await service.listTranslationMissingKeys({ locale: "no" });
        const [foreign] = await service.listTranslationMissingKeys({ locale: "da" });
        const resolve = (id: string) =>
          service.mutateDocument({
            operation: "resolve",
            locale: "no",
            expected_version: 1,
            missing_id: id,
            value: "x",
          });
        await expect(resolve(outage.id)).rejects.toMatchObject({ type: MedusaError.Types.INVALID_DATA });
        await expect(resolve(foreign.id)).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND });
      });

      it("TC-5: resolve rejects a stale version without filling the key", async () => {
        await importLocale("no");
        await service.reportMissing([{ locale: "no", page_path: "/", kind: "key", key: "Cart.new" }]);
        await service.mutateDocument({ operation: "activate", locale: "no", expected_version: 1, is_active: true });
        const [missing] = await service.listTranslationMissingKeys({ locale: "no" });
        await expect(
          service.mutateDocument({
            operation: "resolve",
            locale: "no",
            expected_version: 1,
            missing_id: missing.id,
            value: "Ny",
          })
        ).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT });
        const [row] = await service.listStorefrontTranslations({ locale: "no" });
        expect(row).toMatchObject({ version: 2, messages: english });
        expect(await service.listTranslationMissingKeys({ locale: "no" })).toHaveLength(1);
      });

      it("returns ICU warnings against English without blocking", async () => {
        await importLocale("en");
        const result = await importLocale("sv", { ...english, Common: { ...english.Common, title: "Välkommen" } });
        expect(result.warnings).toEqual([expect.objectContaining({ key: "Common.title", code: "arguments" })]);
        const first = await importLocale("fi");
        expect(first.warnings).toEqual([]);
      });

      it("warns that the reference is unavailable when English is absent", async () => {
        const result = await importLocale("sv");
        expect(result.warnings).toEqual([expect.objectContaining({ code: "reference_unavailable" })]);
      });
    });
  },
});
