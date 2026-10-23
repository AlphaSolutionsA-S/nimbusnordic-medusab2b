import * as pageKeyModule from "../page-keys";

// Every string the module exports is a page key, so a key added later is checked without
// remembering to list it here.
const pageKeys: string[] = Object.values<unknown>(pageKeyModule).filter(
  (value): value is string => typeof value === "string"
);

describe("Admin page keys", () => {
  it("exports one key for each customizable page", () => {
    expect([...pageKeys].sort()).toEqual([
      "approval.list",
      "company.details",
      "company.list",
      "quote.details",
      "quote.list",
      "shipment_tracking.list",
      "storefront_translation.list",
    ]);
  });

  it("are unique", () => {
    expect(new Set(pageKeys).size).toBe(pageKeys.length);
  });

  // Medusa places a widget on every page whose key its zone starts with.
  it("never start with another key", () => {
    const clashes = pageKeys.flatMap((key) =>
      pageKeys
        .filter((other) => other !== key && other.startsWith(key))
        .map((other) => `${key} -> ${other}`)
    );

    expect(clashes).toEqual([]);
  });
});
