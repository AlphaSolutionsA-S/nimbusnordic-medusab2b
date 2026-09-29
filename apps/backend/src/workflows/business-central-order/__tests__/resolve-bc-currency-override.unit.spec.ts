import { resolveBcCurrencyOverride } from "../utils/resolve-bc-currency-override";

describe("resolveBcCurrencyOverride", () => {
  const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;

  afterEach(() => {
    if (originalLcy === undefined) {
      delete process.env.BUSINESS_CENTRAL_LCY_CODE;
    } else {
      process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcy;
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
});
