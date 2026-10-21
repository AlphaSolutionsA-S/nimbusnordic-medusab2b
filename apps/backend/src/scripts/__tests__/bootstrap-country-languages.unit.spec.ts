import { bootstrapMode } from "../bootstrap-country-languages";

describe("bootstrapMode", () => {
  it("is a dry run when no argument is given", () => {
    expect(bootstrapMode([])).toBe("dry-run");
  });

  it("applies only on the bare positional `apply`", () => {
    expect(bootstrapMode(["apply"])).toBe("apply");
  });

  it.each([[["--apply"]], [["aply"]], [["apply", "now"]], [["Apply"]]])(
    "rejects unexpected arguments %j instead of silently running a dry run",
    (args) => {
      expect(() => bootstrapMode(args)).toThrow(/Usage: .*bootstrap-country-languages\.ts \[apply\]/);
    }
  );
});
