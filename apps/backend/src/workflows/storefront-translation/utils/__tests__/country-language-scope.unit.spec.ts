import {
  bootstrapAssignments,
  configuredCountryCodes,
  skipUnavailableAssignments,
} from "../country-language-scope";

describe("configuredCountryCodes", () => {
  it("returns every region's country once, sorted", () => {
    expect(
      configuredCountryCodes([
        { countries: [{ iso_2: "se" }, { iso_2: "dk" }] },
        { countries: [{ iso_2: "dk" }, { iso_2: "gb" }] },
      ])
    ).toEqual(["dk", "gb", "se"]);
  });

  it("is empty without regions or countries and skips malformed codes", () => {
    expect(configuredCountryCodes([])).toEqual([]);
    expect(
      configuredCountryCodes([
        { countries: null },
        { countries: [null, { iso_2: null }, { iso_2: "DK" }, { iso_2: "usa" }, { iso_2: "no" }] },
      ])
    ).toEqual(["no"]);
  });
});

describe("bootstrapAssignments", () => {
  const legacy = { dk: "da", gb: "en", se: "sv", de: "de" };

  it("keeps the legacy language of every configured country only", () => {
    expect(bootstrapAssignments(legacy, ["dk", "gb", "nl"])).toEqual({ dk: "da", gb: "en" });
  });

  it("assigns nothing when no legacy country is configured", () => {
    expect(bootstrapAssignments(legacy, ["nl", "us"])).toEqual({});
  });
});

describe("skipUnavailableAssignments", () => {
  const assignments = { dk: "da", gb: "en", se: "sv", no: "no", fi: "sv" };

  it("skips exactly the countries whose language is unavailable and reports them", () => {
    expect(skipUnavailableAssignments(assignments, ["sv", "no"])).toEqual({
      assignments: { dk: "da", gb: "en" },
      skipped: { se: "sv", no: "no", fi: "sv" },
    });
  });

  it("keeps every assignment when no language is unavailable", () => {
    expect(skipUnavailableAssignments(assignments, [])).toEqual({ assignments, skipped: {} });
  });

  it("never drops a country on an available language when another language is unavailable", () => {
    const result = skipUnavailableAssignments(assignments, ["pl"]);
    expect(result).toEqual({ assignments, skipped: {} });
  });
});
