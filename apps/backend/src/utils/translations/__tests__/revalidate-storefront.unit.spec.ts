import type { Logger } from "@medusajs/framework/types";
import { revalidateStorefrontTranslations } from "../revalidate-storefront";

const SECRET = "callback-secret-value";
const input = { locale: "da", version: 4, is_active: true };

function makeLogger() {
  return { warn: jest.fn() } as unknown as Logger & { warn: jest.Mock };
}

describe("revalidateStorefrontTranslations", () => {
  const env = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.STOREFRONT_TRANSLATION_REVALIDATE_URL = "https://shop.example.test/api/translations/revalidate";
    process.env.REVALIDATE_SECRET = SECRET;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("posts the refresh with the bearer secret, no redirects and a timeout", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await expect(revalidateStorefrontTranslations(input, makeLogger())).resolves.toBe("requested");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://shop.example.test/api/translations/revalidate");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual(input);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["timeout", Object.assign(new Error("timed out"), { name: "TimeoutError" }), "timeout"],
    ["network", new TypeError("fetch failed"), "network"],
  ])("TC-2: defers on %s without leaking the secret or URL", async (_name, error, reason) => {
    fetchMock.mockRejectedValue(error);
    const logger = makeLogger();
    await expect(revalidateStorefrontTranslations(input, logger)).resolves.toBe("deferred");
    const logged = logger.warn.mock.calls.flat().join(" ");
    expect(logged).toContain(`reason=${reason}`);
    expect(logged).toContain("locale=da");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("shop.example.test");
  });

  it("TC-2: defers on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const logger = makeLogger();
    await expect(revalidateStorefrontTranslations(input, logger)).resolves.toBe("deferred");
    expect(logger.warn.mock.calls[0][0]).toContain("reason=status_503");
  });

  it.each([
    [true, 200, "requested"],
    [false, 503, "deferred"],
  ])("releases the response body (ok=%p) even when cancelling fails", async (ok, status, outcome) => {
    const cancel = jest.fn().mockRejectedValue(new Error("already consumed"));
    fetchMock.mockResolvedValue({ ok, status, body: { cancel } });
    await expect(revalidateStorefrontTranslations(input, makeLogger())).resolves.toBe(outcome);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing URL", { STOREFRONT_TRANSLATION_REVALIDATE_URL: "" }, "not_configured"],
    ["missing secret", { REVALIDATE_SECRET: "" }, "not_configured"],
    ["plain HTTP host", { STOREFRONT_TRANSLATION_REVALIDATE_URL: "http://shop.example.test/x" }, "insecure_url"],
    ["credentials in URL", { STOREFRONT_TRANSLATION_REVALIDATE_URL: "https://u:p@shop.example.test/x" }, "invalid_url"],
    ["malformed URL", { STOREFRONT_TRANSLATION_REVALIDATE_URL: "not a url" }, "invalid_url"],
  ])("does not call out with %s", async (_name, overrides, reason) => {
    Object.assign(process.env, overrides);
    const logger = makeLogger();
    await expect(revalidateStorefrontTranslations(input, logger)).resolves.toBe("deferred");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0]).toContain(`reason=${reason}`);
  });

  it("allows loopback HTTP for local validation", async () => {
    process.env.STOREFRONT_TRANSLATION_REVALIDATE_URL = "http://localhost:8000/api/translations/revalidate";
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await expect(revalidateStorefrontTranslations(input, makeLogger())).resolves.toBe("requested");
  });
});
