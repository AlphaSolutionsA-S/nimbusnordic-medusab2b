import { StoreBCReturnsQuery } from "../validators";

describe("StoreBCReturnsQuery", () => {
  // TC-1: happy path — defaults are applied when no query params are given.
  it("defaults limit to 20 and offset to 0", () => {
    const result = StoreBCReturnsQuery.parse({});

    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  // TC-2: edge case — an invalid date format is rejected.
  it("rejects a date_from that is not YYYY-MM-DD", () => {
    expect(() =>
      StoreBCReturnsQuery.parse({ date_from: "01-01-2026" })
    ).toThrow();
  });

  // TC-3: wiring — an unknown query param is rejected by .strict().
  it("rejects an unrecognized query parameter", () => {
    expect(() =>
      StoreBCReturnsQuery.parse({ unexpected: "value" })
    ).toThrow();
  });

  // TC-22 (NIMBUS-172): the open and processed states are accepted.
  it("accepts the open and processed states", () => {
    expect(StoreBCReturnsQuery.parse({ state: "open" })).toEqual({
      limit: 20,
      offset: 0,
      state: "open",
    });
    expect(StoreBCReturnsQuery.parse({ state: "processed" })).toEqual({
      limit: 20,
      offset: 0,
      state: "processed",
    });
  });

  // TC-23 (NIMBUS-172): unknown states and the removed status param are rejected.
  it("rejects an unknown state and the removed status param", () => {
    expect(() => StoreBCReturnsQuery.parse({ state: "Released" })).toThrow();
    expect(() => StoreBCReturnsQuery.parse({ status: "Open" })).toThrow();
  });
});
