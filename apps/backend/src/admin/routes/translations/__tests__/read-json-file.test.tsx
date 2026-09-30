import { MAX_IMPORT_FILE_BYTES, readJsonFile } from "../components/read-json-file";

function file(content: string): File {
  return new File([content], "texts.json", { type: "application/json" });
}

describe("readJsonFile", () => {
  it("returns the parsed object for a valid file", async () => {
    expect(await readJsonFile(file('{"Common":{"title":"Hi"}}'))).toEqual({
      ok: true,
      messages: { Common: { title: "Hi" } },
    });
  });

  it("rejects invalid JSON", async () => {
    expect(await readJsonFile(file("{ not json"))).toEqual({
      ok: false,
      error: "The file is not valid JSON.",
    });
  });

  it("rejects JSON that is not an object", async () => {
    expect(await readJsonFile(file("[1, 2]"))).toEqual({
      ok: false,
      error: "The file must contain a JSON object of texts.",
    });
  });

  it("rejects files over 1 MB", async () => {
    const large = file(`{"a":"${"x".repeat(MAX_IMPORT_FILE_BYTES)}"}`);
    expect(large.size).toBeGreaterThan(MAX_IMPORT_FILE_BYTES);
    expect(await readJsonFile(large)).toEqual({ ok: false, error: "The file is larger than 1 MB." });
  });

  it("accepts a file of exactly 1 MB", async () => {
    const padding = "x".repeat(MAX_IMPORT_FILE_BYTES - '{"a":""}'.length);
    const exact = file(`{"a":"${padding}"}`);
    expect(exact.size).toBe(MAX_IMPORT_FILE_BYTES);
    expect(await readJsonFile(exact)).toMatchObject({ ok: true });
  });
});
