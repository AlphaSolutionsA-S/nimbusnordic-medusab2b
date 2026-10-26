import { chooseEmailLanguage } from "../email-language";

const configuredCountries = ["dk", "fi", "no", "se"];
const assignments = { dk: "da", no: "nb", se: "sv" };

describe("chooseEmailLanguage", () => {
  it("uses the assigned language of a request country in a region, linking to that country", () => {
    expect(
      chooseEmailLanguage({ requestCountry: "se", configuredCountries, assignments })
    ).toEqual({ locale: "sv", linkCountry: "se" });
  });

  it("uses English for an unassigned request country in a region, still linking to it", () => {
    expect(
      chooseEmailLanguage({ requestCountry: "fi", configuredCountries, assignments })
    ).toEqual({ locale: "en", linkCountry: "fi" });
  });

  it.each([undefined, null, "../evil", "SE", "x", 42, "gb"])(
    "falls to the company country when the request country is %p",
    (requestCountry) => {
      expect(
        chooseEmailLanguage({
          requestCountry,
          companyCountry: "no",
          configuredCountries,
          assignments,
        })
      ).toEqual({ locale: "nb", linkCountry: "no" });
    }
  );

  it.each([" DK ", "dk", "DK"])("uses company country %p once trimmed and lower-cased", (companyCountry) => {
    expect(
      chooseEmailLanguage({ companyCountry, configuredCountries, assignments })
    ).toEqual({ locale: "da", linkCountry: "dk" });
  });

  it.each(["Denmark", "XX", "gb", "", null, undefined])(
    "gives English and the dk link when company country %p is unusable",
    (companyCountry) => {
      expect(
        chooseEmailLanguage({
          requestCountry: "../evil",
          companyCountry,
          configuredCountries: ["fi", "se"],
          assignments: { se: "sv" },
        })
      ).toEqual({ locale: "en", linkCountry: "dk" });
    }
  );

  it("does not trim or lower-case the request country", () => {
    expect(
      chooseEmailLanguage({ requestCountry: " se ", configuredCountries, assignments })
    ).toEqual({ locale: "en", linkCountry: "dk" });
  });

  it("uses English with the chosen link country when assignments are not initialized", () => {
    expect(
      chooseEmailLanguage({ requestCountry: "se", configuredCountries, assignments: null })
    ).toEqual({ locale: "en", linkCountry: "se" });
    expect(
      chooseEmailLanguage({ companyCountry: "NO", configuredCountries, assignments: null })
    ).toEqual({ locale: "en", linkCountry: "no" });
  });

  it("prefers a usable request country over a different usable company country", () => {
    expect(
      chooseEmailLanguage({
        requestCountry: "se",
        companyCountry: "dk",
        configuredCountries,
        assignments,
      })
    ).toEqual({ locale: "sv", linkCountry: "se" });
  });

  it("ignores inherited object keys as assignments", () => {
    expect(
      chooseEmailLanguage({
        requestCountry: "fi",
        configuredCountries,
        assignments: Object.create({ fi: "fi" }),
      })
    ).toEqual({ locale: "en", linkCountry: "fi" });
  });
});
