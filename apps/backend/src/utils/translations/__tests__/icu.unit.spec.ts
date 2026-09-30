import { compareIcu } from "../icu";

describe("compareIcu", () => {
  const reference = {
    Cart: {
      items: "{count, plural, one {# item} other {# items}}",
      greeting: "Hello {name}",
      terms: "Accept <link>terms</link>",
      role: "{gender, select, male {He} female {She} other {They}}",
      total: "Total {amount, number}",
    },
  };

  it("TC-4: accepts equivalent arguments with different plural categories", () => {
    const polish = {
      Cart: {
        items: "{count, plural, one {# produkt} few {# produkty} many {# produktów} other {# produktu}}",
        greeting: "Cześć {name}",
        terms: "Akceptuj <link>regulamin</link>",
        role: "{gender, select, male {On} female {Ona} other {Oni}}",
        total: "Razem {amount, number}",
      },
    };
    expect(compareIcu(polish, reference)).toEqual([]);
  });

  it("TC-4: warns about missing arguments and tags", () => {
    const warnings = compareIcu(
      { Cart: { ...reference.Cart, greeting: "Hej", terms: "Accepter vilkår" } },
      reference
    );
    expect(warnings).toEqual([
      expect.objectContaining({ key: "Cart.greeting", code: "arguments" }),
      expect.objectContaining({ key: "Cart.terms", code: "structure" }),
    ]);
  });

  it("TC-4: warns about changed formats and select options", () => {
    const warnings = compareIcu(
      {
        Cart: {
          ...reference.Cart,
          total: "Total {amount}",
          role: "{gender, select, male {Han} other {De}}",
        },
      },
      reference
    );
    expect(warnings.map((warning) => [warning.key, warning.code])).toEqual([
      ["Cart.role", "structure"],
      ["Cart.total", "arguments"],
    ]);
  });

  it("TC-4: reports malformed ICU as a warning, not an exception", () => {
    expect(compareIcu({ Cart: { greeting: "Hello {name" } }, reference)).toEqual([
      expect.objectContaining({ key: "Cart.greeting", code: "invalid_icu" }),
    ]);
  });

  it("TC-4: reports a missing reference without failing", () => {
    const warnings = compareIcu({ Cart: { greeting: "Hej {name}" } }, null);
    expect(warnings).toEqual([expect.objectContaining({ code: "reference_unavailable" })]);
  });

  it("ignores keys absent from the reference", () => {
    expect(compareIcu({ Other: { x: "{a}" } }, reference)).toEqual([]);
  });
});
