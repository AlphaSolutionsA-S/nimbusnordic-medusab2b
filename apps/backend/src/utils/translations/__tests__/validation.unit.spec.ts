import {
  keyPathProblem,
  localeSchema,
  MAX_DEPTH,
  MAX_DOCUMENT_BYTES,
  MAX_LEAVES,
  MAX_VALUE_BYTES,
  messageDocumentSchema,
} from "../validation";

describe("translation validation", () => {
  it("canonicalizes valid BCP 47 locales", () => {
    expect(localeSchema.parse("da")).toBe("da");
    expect(localeSchema.parse("pt-br")).toBe("pt-BR");
    expect(localeSchema.parse("EN")).toBe("en");
  });

  it.each(["", " da", "en_US", "x", "da/../en", "a".repeat(65), "en US"])(
    "rejects the invalid locale %p",
    (value) => {
      expect(localeSchema.safeParse(value).success).toBe(false);
    }
  );

  it("rejects non-string locales", () => {
    expect(localeSchema.safeParse(42).success).toBe(false);
  });

  it("accepts a nested document with empty strings and groups", () => {
    const document = { Common: { title: "", group: {} }, Cart: "Kurv" };
    expect(messageDocumentSchema.parse(document)).toEqual(document);
  });

  it("TC-3: rejects __proto__ from JSON.parse without changing prototypes", () => {
    const parsed = JSON.parse('{"__proto__": {"polluted": "yes"}, "A": "a"}');
    const result = messageDocumentSchema.safeParse(parsed);
    expect(result.success).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["constructor", { A: { constructor: "x" } }],
    ["prototype", { prototype: "x" }],
    ["dotted", { "A.B": "x" }],
    ["empty segment", { "": "x" }],
    ["array", { A: ["x"] }],
    ["null", { A: null }],
    ["number", { A: 1 }],
    ["root array", ["x"]],
    ["root string", "x"],
    ["reserved outage key", { __locale_unavailable__: "x" }],
  ])("TC-3: rejects %s", (_name, value) => {
    expect(messageDocumentSchema.safeParse(value).success).toBe(false);
  });

  it("TC-3: rejects documents nested beyond the depth limit", () => {
    let deep: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < MAX_DEPTH; i++) {
      deep = { [`level${i}`]: deep };
    }
    expect(messageDocumentSchema.safeParse(deep).success).toBe(false);
  });

  it("TC-3: accepts the maximum depth", () => {
    let deep: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < MAX_DEPTH - 2; i++) {
      deep = { [`level${i}`]: deep };
    }
    expect(messageDocumentSchema.safeParse(deep).success).toBe(true);
  });

  it("TC-3: enforces the leaf count", () => {
    const many: Record<string, string> = {};
    for (let i = 0; i <= MAX_LEAVES; i++) {
      many[`k${i}`] = "v";
    }
    expect(messageDocumentSchema.safeParse({ A: many }).success).toBe(false);
  });

  it("TC-3: measures values in UTF-8 bytes near the limit", () => {
    const threeByte = "€";
    const fits = threeByte.repeat(Math.floor(MAX_VALUE_BYTES / 3));
    expect(messageDocumentSchema.safeParse({ A: fits }).success).toBe(true);
    expect(messageDocumentSchema.safeParse({ A: fits + threeByte }).success).toBe(false);
  });

  it("TC-3: enforces the whole-document byte limit", () => {
    const value = "x".repeat(MAX_VALUE_BYTES - 100);
    const document: Record<string, string> = {};
    for (let i = 0; i < Math.ceil(MAX_DOCUMENT_BYTES / value.length) + 1; i++) {
      document[`k${i}`] = value;
    }
    const result = messageDocumentSchema.safeParse(document);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain(value);
  });

  it("validates standalone key paths", () => {
    expect(keyPathProblem("Common.notFound.headingLabel")).toBeNull();
    expect(keyPathProblem("Common..x")).not.toBeNull();
    expect(keyPathProblem("__locale_unavailable__")).not.toBeNull();
    expect(keyPathProblem("a.".repeat(300) + "b")).not.toBeNull();
  });
});
