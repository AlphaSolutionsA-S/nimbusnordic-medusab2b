import { resolveBcCurrencyOverride } from "../utils/resolve-bc-currency-override";

describe("resolveBcCurrencyOverride", () => {
  const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;
  const originalNoLcy = process.env.BUSINESS_CENTRAL_NO_LCY_CODE;

  afterEach(() => {
    if (originalLcy === undefined) {
      delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcy;
    }
    if (originalNoLcy === undefined) {
      delete process.env.BUSINESS_CENTRAL_NO_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_NO_LCY_CODE = originalNoLcy;
    }
  });

  it("CUR-1: omits the currency when it matches the BC customer currency", () => {
    expect(resolveBcCurrencyOverride("EUR", "EUR")).toBeUndefined();
  });

  it("CUR-2: compares case-insensitively", () => {
    expect(resolveBcCurrencyOverride("dkk", "DKK")).toBeUndefined();
  });

  it("CUR-3: sends the uppercased order currency when it differs", () => {
    expect(resolveBcCurrencyOverride("eur", "DKK")).toEqual("EUR");
  });

  it("CUR-4: treats a blank BC currency as the default local currency DKK", () => {
    delete process.env.BUSINESS_CENTRAL_LCY_CODE;

    expect(resolveBcCurrencyOverride("DKK", null)).toBeUndefined();
    expect(resolveBcCurrencyOverride("DKK", "  ")).toBeUndefined();
    expect(resolveBcCurrencyOverride("EUR", null)).toEqual("EUR");
  });

  it("CUR-5: honours BUSINESS_CENTRAL_LCY_CODE for a blank BC currency", () => {
    process.env.BUSINESS_CENTRAL_LCY_CODE = "SEK";

    expect(resolveBcCurrencyOverride("SEK", null)).toBeUndefined();
    expect(resolveBcCurrencyOverride("DKK", null)).toEqual("DKK");
  });

  it("resolves a blank BC currency with the Danish local currency, never the Norwegian one", () => {
    delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    process.env.BUSINESS_CENTRAL_NO_LCY_CODE = "NOK";

    expect(resolveBcCurrencyOverride("DKK", null)).toBeUndefined();
    expect(resolveBcCurrencyOverride("NOK", null)).toEqual("NOK");
  });
});
