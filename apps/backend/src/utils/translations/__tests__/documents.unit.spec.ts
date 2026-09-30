import {
  compareMissing,
  diffMessages,
  flattenMessages,
  labelForKey,
  mergeMessages,
  MessageDocumentError,
  sameStructure,
  unflattenMessages,
  updateMessageLeaves,
} from "../documents";
import type { MessageDocument } from "../../../types/storefront-translation";

const sample = (): MessageDocument => ({
  Common: { notFound: { headingLabel: "Siden blev ikke fundet", empty: "" } },
  Cart: { title: "Kurv – ÆØÅ 🛒", items: "{count, plural, one {# vare} other {# varer}}" },
});

describe("document helpers", () => {
  it("TC-1: round-trips string leaves, including Unicode and empty strings, without mutating input", () => {
    const input = sample();
    const snapshot = JSON.stringify(input);
    const flat = flattenMessages(input);
    expect(flat).toEqual({
      "Cart.items": "{count, plural, one {# vare} other {# varer}}",
      "Cart.title": "Kurv – ÆØÅ 🛒",
      "Common.notFound.empty": "",
      "Common.notFound.headingLabel": "Siden blev ikke fundet",
    });
    expect(unflattenMessages(flat)).toEqual(input);
    expect(JSON.parse(JSON.stringify(unflattenMessages(flat)))).toEqual(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("TC-1: updates leaves while preserving empty nested groups", () => {
    const input: MessageDocument = { A: { keep: {}, text: "old" }, B: {} };
    const updated = updateMessageLeaves(input, { "A.text": "new" });
    expect(updated).toEqual({ A: { keep: {}, text: "new" }, B: {} });
    expect(input.A).toEqual({ keep: {}, text: "old" });
    expect(sameStructure(input, updated)).toBe(true);
  });

  it("TC-1: rejects leaf updates that add or omit keys", () => {
    const input: MessageDocument = { A: { text: "old", other: "x" } };
    expect(() => updateMessageLeaves(input, { "A.text": "new", "A.other": "x", "A.new": "y" }))
      .toThrow(MessageDocumentError);
    expect(() => updateMessageLeaves(input, { "A.text": "new" })).toThrow(/A.other/);
  });

  it("TC-2: diffs added, changed, removed and empty keys deterministically", () => {
    const current: MessageDocument = { A: { one: "1", two: "2", three: "3" } };
    const candidate: MessageDocument = { A: { one: "1", two: "zwei", four: " " } };
    expect(diffMessages(current, candidate)).toEqual({
      added: ["A.four"],
      changed: ["A.two"],
      removed: ["A.three"],
      empty: ["A.four"],
    });
  });

  it("TC-2: merge preserves omitted keys and overwrites supplied leaves immutably", () => {
    const current: MessageDocument = { A: { one: "1", two: "2" }, Empty: {} };
    const incoming: MessageDocument = { A: { two: "zwei", three: "drei" } };
    const merged = mergeMessages(current, incoming);
    expect(merged).toEqual({ A: { one: "1", two: "zwei", three: "drei" }, Empty: {} });
    expect(current).toEqual({ A: { one: "1", two: "2" }, Empty: {} });
  });

  it("TC-2: rejects a string/object collision with its key path", () => {
    expect(() => mergeMessages({ A: "text" }, { A: { B: "nested" } })).toThrow(/"A"/);
    expect(() => mergeMessages({ A: { B: "x" } }, { A: "text" })).toThrow(MessageDocumentError);
    expect(() => unflattenMessages({ A: "x", "A.B": "y" })).toThrow(MessageDocumentError);
  });

  it("TC-2: unflatten refuses prototype-polluting segments", () => {
    expect(() => unflattenMessages({ "__proto__.polluted": "yes" })).toThrow(MessageDocumentError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("TC-5: derives section, group and label from the key path", () => {
    expect(labelForKey("Common.notFound.headingLabel")).toEqual({
      section: "Common",
      group: "Not found",
      label: "Heading label",
    });
    expect(labelForKey("Checkout.address_form.first-name")).toEqual({
      section: "Checkout",
      group: "Address form",
      label: "First name",
    });
    expect(labelForKey("Common.title").group).toBe("");
  });

  it("TC-5: equal labels on different paths keep distinct identities", () => {
    const document: MessageDocument = { A: { x: { title: "1" } }, B: { x: { title: "2" } } };
    const flat = flattenMessages(document);
    expect(Object.keys(flat)).toEqual(["A.x.title", "B.x.title"]);
    expect(labelForKey("A.x.title").label).toBe(labelForKey("B.x.title").label);
  });

  it("lists reference keys missing or blank in the current document", () => {
    expect(compareMissing({ A: { one: "1", two: "  " } }, { A: { one: "a", two: "b", three: "c" } }))
      .toEqual(["A.three", "A.two"]);
  });
});
