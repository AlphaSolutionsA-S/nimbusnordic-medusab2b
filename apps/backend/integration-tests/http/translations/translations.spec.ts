import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import { createAdminUser, createStoreUser } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../src/modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../src/modules/storefront-translation/service";

jest.setTimeout(120_000);

const REPORT_SECRET = "test-report-secret-value";
process.env.TRANSLATION_REPORT_SECRET = REPORT_SECRET;

const english = {
  Common: { notFound: { headingLabel: "Page not found", empty: {} }, hello: "Hello {name}" },
  Cart: { title: "Cart ÆØÅ 🛒", note: "" },
};

type Headers = { headers: Record<string, string> };
const noThrow = { validateStatus: () => true };

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer;
    let admin: Headers;
    let store: Headers;
    let customer: Headers;
    const reporter = { headers: { authorization: `Bearer ${REPORT_SECRET}` } };

    beforeEach(async () => {
      container = getContainer();
      admin = { headers: {} };
      await createAdminUser(admin, container);
      store = generateStoreHeaders({ publishableKey: await generatePublishableKey(container) });
      const user = await createStoreUser({ api, storeHeaders: store });
      customer = { headers: { ...store.headers, authorization: `Bearer ${user.token}` } };
    });

    const importLocale = (locale: string, messages: unknown = english, headers: Headers = admin) =>
      api.post(
        `/admin/ui-translations/${locale}/import`,
        { expected_version: null, mode: "replace", messages },
        { ...headers, ...noThrow }
      );

    const activate = async (locale: string, version: number, is_active = true) =>
      api.post(
        `/admin/ui-translations/${locale}/activation`,
        { expected_version: version, is_active },
        { ...admin, ...noThrow }
      );

    const service = () =>
      container.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);

    describe("TC-1 access control", () => {
      it("allows only admins on Admin routes", async () => {
        expect((await importLocale("en")).status).toBe(201);
        const requests: Array<[string, string, unknown?]> = [
          ["get", "/admin/ui-translations"],
          ["get", "/admin/ui-translations/en"],
          ["get", "/admin/ui-translations/en/export"],
          ["get", "/admin/ui-translations/missing-keys"],
          ["post", "/admin/ui-translations/en", { expected_version: 1, messages: english }],
          ["post", "/admin/ui-translations/en/activation", { expected_version: 2, is_active: true }],
          ["post", "/admin/ui-translations", { locale: "nl", source: "import", messages: english }],
        ];
        for (const [method, url, data] of requests) {
          for (const headers of [customer, store, { headers: {} }]) {
            const response = await api.request({ method, url, data, ...headers, ...noThrow });
            expect({ url, status: response.status }).toEqual({ url, status: 401 });
          }
          const allowed = await api.request({ method, url, data, ...admin, ...noThrow });
          expect({ url, ok: allowed.status < 300 }).toEqual({ url, ok: true });
        }
      });

      it("serves only active locales publicly and requires a publishable key", async () => {
        await importLocale("da");
        const inactive = await api.get("/store/ui-translations/da", { ...store, ...noThrow });
        expect(inactive.status).toBe(404);
        expect(inactive.data).toMatchObject({ code: "translation_inactive", message: "translation_inactive" });
        const absent = await api.get("/store/ui-translations/fi", { ...store, ...noThrow });
        expect(absent.data).toMatchObject({ code: "translation_not_found", message: "translation_not_found" });
        expect(absent.headers["cache-control"]).toBe("no-store");

        await activate("da", 1);
        const active = await api.get("/store/ui-translations/da", store);
        expect(active.data.translation).toMatchObject({ locale: "da", version: 2, is_active: true });
        expect(active.data.translation.messages).toEqual(english);
        expect(JSON.stringify(active.data)).not.toContain("missing");

        const noKey = await api.get("/store/ui-translations/da", noThrow);
        expect(noKey.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe("TC-2 normal edits keep the key set", () => {
      it("rejects removed or new keys through a normal save", async () => {
        await importLocale("en");
        const added = await api.post(
          "/admin/ui-translations/en",
          { expected_version: 1, messages: { ...english, Cart: { ...english.Cart, extra: "x" } } },
          { ...admin, ...noThrow }
        );
        expect(added.status).toBe(400);
        const removed = await api.post(
          "/admin/ui-translations/en",
          { expected_version: 1, messages: { Cart: english.Cart } },
          { ...admin, ...noThrow }
        );
        expect(removed.status).toBe(400);
        const saved = await api.post(
          "/admin/ui-translations/en",
          { expected_version: 1, messages: { ...english, Cart: { ...english.Cart, title: "Basket" } } },
          admin
        );
        expect(saved.data).toMatchObject({ translation: { version: 2 }, refresh: "not_needed" });
        const stale = await api.post(
          "/admin/ui-translations/en",
          { expected_version: 1, messages: english },
          { ...admin, ...noThrow }
        );
        expect(stale.status).toBe(409);
      });
    });

    describe("TC-3 imports", () => {
      it("previews, rejects unconfirmed and stale replaces, and applies a confirmed current one", async () => {
        await importLocale("en");
        const replacement = { Cart: { title: "Cart v2" } };
        const preview = await api.post(
          "/admin/ui-translations/en/import-preview",
          { expected_version: 1, mode: "replace", messages: replacement },
          admin
        );
        expect(preview.data.diff).toEqual({
          added: [],
          changed: ["Cart.title"],
          removed: ["Cart.note", "Common.hello", "Common.notFound.headingLabel"],
          empty: [],
        });
        const unconfirmed = await api.post(
          "/admin/ui-translations/en/import",
          { expected_version: 1, mode: "replace", messages: replacement },
          { ...admin, ...noThrow }
        );
        expect(unconfirmed.status).toBe(400);
        const stale = await api.post(
          "/admin/ui-translations/en/import",
          { expected_version: 9, mode: "replace", messages: replacement, confirm_removed: true },
          { ...admin, ...noThrow }
        );
        expect(stale.status).toBe(409);
        const exported = await api.get("/admin/ui-translations/en/export", admin);
        expect(exported.data).toEqual(english);

        const applied = await api.post(
          "/admin/ui-translations/en/import",
          { expected_version: 1, mode: "replace", messages: replacement, confirm_removed: true },
          admin
        );
        expect(applied.status).toBe(200);
        expect(applied.data.translation).toMatchObject({ version: 2, messages: replacement });
      });

      it("merges without removing existing keys", async () => {
        await importLocale("en");
        const merged = await api.post(
          "/admin/ui-translations/en/import",
          { expected_version: 1, mode: "merge", messages: { Cart: { added: "New" } } },
          admin
        );
        expect(merged.data.translation.messages.Cart).toEqual({ ...english.Cart, added: "New" });
      });

      it("allows one of two simultaneous first imports", async () => {
        const [first, second] = await Promise.all([importLocale("sv"), importLocale("sv")]);
        expect([first.status, second.status].sort()).toEqual([201, 409]);
      });
    });

    describe("TC-4 first import without English", () => {
      it("creates an inactive language with a reference warning", async () => {
        const response = await importLocale("pl");
        expect(response.status).toBe(201);
        expect(response.data.translation).toMatchObject({ locale: "pl", version: 1, is_active: false });
        expect(response.data.warnings).toEqual([
          expect.objectContaining({ code: "reference_unavailable" }),
        ]);
        const list = await api.get("/admin/ui-translations", admin);
        expect(list.data.locales).toEqual([
          expect.objectContaining({ locale: "pl", version: 1, is_active: false }),
        ]);
        expect(list.data.locales[0].messages).toBeUndefined();
      });

      it("creates a copy at the source version as inactive", async () => {
        await importLocale("en");
        await activate("en", 1);
        const copy = await api.post(
          "/admin/ui-translations",
          { locale: "pt-br", source: "copy", source_locale: "en", source_version: 2 },
          admin
        );
        expect(copy.status).toBe(201);
        expect(copy.data.translation).toMatchObject({ locale: "pt-BR", is_active: false, version: 1 });
      });
    });

    describe("TC-5 boundary validation", () => {
      it.each([
        ["prototype key", '{"expected_version":null,"mode":"replace","messages":{"__proto__":{"x":"y"}}}'],
        ["array value", '{"expected_version":null,"mode":"replace","messages":{"A":["x"]}}'],
        ["dotted key", '{"expected_version":null,"mode":"replace","messages":{"A.B":"x"}}'],
        ["unknown field", '{"expected_version":null,"mode":"replace","messages":{},"is_active":true}'],
        ["malformed JSON", '{"expected_version":null,'],
      ])("rejects %s without writing", async (_name, body) => {
        const response = await api.post("/admin/ui-translations/en/import", body, {
          headers: { ...admin.headers, "content-type": "application/json" },
          ...noThrow,
        });
        expect(response.status).toBe(400);
        expect(await service().listStorefrontTranslations({})).toHaveLength(0);
      });

      it("rejects an invalid locale in the URL", async () => {
        expect((await importLocale("en_US")).status).toBe(400);
      });

      it("rejects the reserved missing-keys route segment as a language code", async () => {
        const imported = await importLocale("Missing-Keys");
        expect(imported.status).toBe(400);
        expect(imported.data.message).toContain("reserved");
        const created = await api.post(
          "/admin/ui-translations",
          { locale: "missing-keys", source: "import", messages: english },
          { ...admin, ...noThrow }
        );
        expect(created.status).toBe(400);
        expect(await service().listStorefrontTranslations({})).toHaveLength(0);
      });

      it("measures a resolved value in UTF-8 bytes", async () => {
        const value = "€".repeat(Math.floor((16 * 1024) / 3) + 1);
        const response = await api.post(
          "/admin/ui-translations/en/missing-keys/trmk_01TEST/resolve",
          { expected_version: 1, value },
          { ...admin, ...noThrow }
        );
        expect(response.status).toBe(400);
        expect(response.data.message).toContain("16 KiB");
      });

      it("rejects oversized bodies", async () => {
        const big = { A: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, "x".repeat(16000)])) };
        const response = await importLocale("en", big);
        expect([400, 413]).toContain(response.status);
        expect(await service().listStorefrontTranslations({})).toHaveLength(0);
      });

      it("rejects an excessive report batch", async () => {
        const reports = Array.from({ length: 51 }, () => ({
          kind: "key", locale: "en", page_path: "/", key: "A.b",
        }));
        const response = await api.post("/internal/ui-translations/missing-keys", { reports }, {
          ...reporter,
          ...noThrow,
        });
        expect(response.status).toBe(400);
      });
    });

    describe("TC-6 missing-key reporting", () => {
      const report = { kind: "key", locale: "en", page_path: "/gb/cart", key: "Cart.missing" };

      it("denies absent or wrong secrets and customer/publishable credentials", async () => {
        const wrongSecrets = ["Bearer wrong", `Bearer ${REPORT_SECRET}x`, `Bearer ${REPORT_SECRET.slice(0, -1)}`];
        for (const headers of [
          { headers: {} },
          ...wrongSecrets.map((authorization) => ({ headers: { authorization } })),
          customer,
          store,
        ]) {
          const response = await api.post("/internal/ui-translations/missing-keys", { reports: [report] }, {
            ...headers,
            ...noThrow,
          });
          expect(response.status).toBe(401);
        }
        const configured = process.env.TRANSLATION_REPORT_SECRET;
        process.env.TRANSLATION_REPORT_SECRET = "";
        const unconfigured = await api.post(
          "/internal/ui-translations/missing-keys",
          { reports: [report] },
          { headers: { authorization: "Bearer " }, ...noThrow }
        );
        process.env.TRANSLATION_REPORT_SECRET = configured;
        expect(unconfigured.status).toBe(401);
      });

      it("deduplicates, ignores filled keys and lists an unprovisioned outage", async () => {
        await importLocale("en");
        const response = await api.post(
          "/internal/ui-translations/missing-keys",
          {
            reports: [
              report,
              report,
              { ...report, key: "Cart.title" },
              { kind: "locale_unavailable", locale: "fi", page_path: "/" },
            ],
          },
          reporter
        );
        expect(response.status).toBe(202);
        expect(response.data).toEqual({ accepted: 3, ignored: 1 });
        const all = await api.get("/admin/ui-translations/missing-keys", admin);
        expect(all.data.count).toBe(2);
        expect(all.data.missing_keys).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ locale: "en", key: "Cart.missing", count: 2 }),
            expect.objectContaining({ locale: "fi", key: "__locale_unavailable__" }),
          ])
        );
        const filtered = await api.get("/admin/ui-translations/missing-keys?locale=en&limit=1", admin);
        expect(filtered.data).toMatchObject({ count: 1, limit: 1, offset: 0 });
      });

      it("resolves a report, after which re-reports are ignored", async () => {
        await importLocale("en");
        await api.post("/internal/ui-translations/missing-keys", { reports: [report] }, reporter);
        const [row] = (await api.get("/admin/ui-translations/missing-keys?locale=en", admin)).data.missing_keys;
        const resolved = await api.post(
          `/admin/ui-translations/en/missing-keys/${row.id}/resolve`,
          { expected_version: 1, value: "Missing no more" },
          admin
        );
        expect(resolved.data.translation.messages.Cart.missing).toBe("Missing no more");
        const again = await api.post("/internal/ui-translations/missing-keys", { reports: [report] }, reporter);
        expect(again.data).toEqual({ accepted: 0, ignored: 1 });
        expect((await api.get("/admin/ui-translations/missing-keys", admin)).data.count).toBe(0);
      });

      it("dismisses a report within its locale only", async () => {
        await importLocale("en");
        await api.post("/internal/ui-translations/missing-keys", { reports: [report] }, reporter);
        const [row] = (await api.get("/admin/ui-translations/missing-keys", admin)).data.missing_keys;
        const wrongLocale = await api.post(`/admin/ui-translations/da/missing-keys/${row.id}/dismiss`, {}, {
          ...admin,
          ...noThrow,
        });
        expect(wrongLocale.status).toBe(404);
        const dismissed = await api.post(`/admin/ui-translations/en/missing-keys/${row.id}/dismiss`, {}, admin);
        expect(dismissed.data).toEqual({ dismissed: true });
        expect((await api.get("/admin/ui-translations/missing-keys", admin)).data.count).toBe(0);
      });
    });

    describe("Task 07 storefront refresh callback", () => {
      type Received = { authorization?: string; body: string };
      let server: Server;
      let received: Received[];
      let behaviour: "ok" | "fail" | "hang";

      beforeEach(async () => {
        received = [];
        behaviour = "ok";
        server = createServer((request, response) => {
          let body = "";
          request.on("data", (chunk) => (body += chunk));
          request.on("end", () => {
            received.push({ authorization: request.headers.authorization, body });
            if (behaviour === "hang") {
              return;
            }
            response.statusCode = behaviour === "ok" ? 200 : 500;
            response.end("{}");
          });
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const { port } = server.address() as AddressInfo;
        process.env.STOREFRONT_TRANSLATION_REVALIDATE_URL = `http://127.0.0.1:${port}/api/translations/revalidate`;
        process.env.REVALIDATE_SECRET = "callback-secret";
      });

      afterEach(async () => {
        delete process.env.STOREFRONT_TRANSLATION_REVALIDATE_URL;
        delete process.env.REVALIDATE_SECRET;
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      });

      it("requests a refresh after activation and active saves, not for inactive edits", async () => {
        await importLocale("da");
        expect(received).toHaveLength(0);
        const activated = await activate("da", 1);
        expect(activated.data.refresh).toBe("requested");
        expect(received).toHaveLength(1);
        expect(received[0].authorization).toBe("Bearer callback-secret");
        expect(JSON.parse(received[0].body)).toEqual({ locale: "da", version: 2, is_active: true });
      });

      it.each(["fail", "hang"] as const)(
        "TC-2: a %s callback still returns the committed save with refresh deferred",
        async (mode) => {
          await importLocale("da");
          await activate("da", 1);
          behaviour = mode;
          const saved = await api.post(
            "/admin/ui-translations/da",
            { expected_version: 2, messages: { ...english, Cart: { ...english.Cart, title: "Kurv" } } },
            admin
          );
          expect(saved.status).toBe(200);
          expect(saved.data).toMatchObject({ refresh: "deferred", translation: { version: 3 } });
          const [row] = await service().listStorefrontTranslations({ locale: "da" });
          expect(row.version).toBe(3);
        }
      );
    });

    describe("TC-7 resolution safety and round trips", () => {
      it("refuses the outage sentinel and IDs from another locale", async () => {
        await importLocale("en");
        await importLocale("da");
        await api.post(
          "/internal/ui-translations/missing-keys",
          {
            reports: [
              { kind: "locale_unavailable", locale: "en", page_path: "/" },
              { kind: "key", locale: "da", page_path: "/", key: "Cart.x" },
            ],
          },
          reporter
        );
        const rows = (await api.get("/admin/ui-translations/missing-keys", admin)).data.missing_keys;
        const outage = rows.find((row: { locale: string }) => row.locale === "en");
        const foreign = rows.find((row: { locale: string }) => row.locale === "da");
        const attempt = (id: string) =>
          api.post(`/admin/ui-translations/en/missing-keys/${id}/resolve`, { expected_version: 1, value: "x" }, {
            ...admin,
            ...noThrow,
          });
        expect((await attempt(outage.id)).status).toBe(400);
        expect((await attempt(foreign.id)).status).toBe(404);
      });

      it("round-trips export and import with nesting, Unicode, ICU and empty groups", async () => {
        await importLocale("en");
        const exported = await api.get("/admin/ui-translations/en/export", admin);
        expect(exported.headers["content-disposition"]).toBe('attachment; filename="en.json"');
        expect(exported.headers["content-type"]).toContain("application/json");
        await importLocale("de", exported.data);
        const reloaded = await api.get("/admin/ui-translations/de", admin);
        expect(reloaded.data.translation.messages).toEqual(english);
      });
    });
  },
});
