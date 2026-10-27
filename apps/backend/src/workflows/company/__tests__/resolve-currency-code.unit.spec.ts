import { resolveCurrencyCode } from "../utils/resolve-currency-code";

const LCY_VARIABLES = [
  "BUSINESS_CENTRAL_LCY_CODE",
  "BUSINESS_CENTRAL_NO_LCY_CODE",
] as const;

describe("resolveCurrencyCode", () => {
  const original = Object.fromEntries(
    LCY_VARIABLES.map((variable) => [variable, process.env[variable]])
  );

  beforeEach(() => {
    for (const variable of LCY_VARIABLES) {
      delete process.env[variable];
    }
  });

  afterAll(() => {
    for (const variable of LCY_VARIABLES) {
      const value = original[variable];
      if (value === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = value;
      }
    }
  });

  it.each([
    ["NO", null, "NOK"],
    ["NO", "  ", "NOK"],
    ["DK", null, "DKK"],
    ["DK", "", "DKK"],
  ] as const)(
    "resolves a blank card currency in %s (%j) to the local currency %s",
    (environment, cardCurrency, expected) => {
      expect(resolveCurrencyCode(environment, cardCurrency)).toBe(expected);
    }
  );

  it("respects each environment's configured local currency for a blank card currency", () => {
    process.env.BUSINESS_CENTRAL_LCY_CODE = "SEK";
    process.env.BUSINESS_CENTRAL_NO_LCY_CODE = " EUR ";

    expect(resolveCurrencyCode("DK", null)).toBe("SEK");
    expect(resolveCurrencyCode("NO", null)).toBe("EUR");
  });

  it("does not let the Danish setting change the Norwegian fallback", () => {
    process.env.BUSINESS_CENTRAL_LCY_CODE = "SEK";

    expect(resolveCurrencyCode("NO", null)).toBe("NOK");
  });

  it.each(["DK", "NO"] as const)(
    "keeps a set card currency, trimmed, in %s",
    (environment) => {
      process.env.BUSINESS_CENTRAL_LCY_CODE = "SEK";
      process.env.BUSINESS_CENTRAL_NO_LCY_CODE = "SEK";

      expect(resolveCurrencyCode(environment, " EUR ")).toBe("EUR");
    }
  );
});
