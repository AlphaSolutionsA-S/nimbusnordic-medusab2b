import { escapeHtml } from "../escape-html";

describe("escapeHtml", () => {
  it("escapes a script tag", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes double and single quotes so a text cannot leave an attribute", () => {
    expect(escapeHtml(`"><a href='x'>`)).toBe("&quot;&gt;&lt;a href=&#39;x&#39;&gt;");
  });

  it("escapes an ampersand once, including one that already looks like an entity", () => {
    expect(escapeHtml("Fish & Chips &amp;")).toBe("Fish &amp; Chips &amp;amp;");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Nulstil din adgangskode")).toBe("Nulstil din adgangskode");
  });
});
