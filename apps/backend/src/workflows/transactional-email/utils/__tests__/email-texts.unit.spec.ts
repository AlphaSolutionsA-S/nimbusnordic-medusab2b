import { resolveEmailTexts, type EmailTextsInput } from "../email-texts";

const keys = {
  "Emails.test.subject": "Reset your password",
  "Emails.test.greeting": "Hi {firstName},",
  "Emails.test.intro": "You were invited to {companyName}.",
};
const source = "email:test";

const danish = {
  Emails: {
    test: {
      subject: "Nulstil din adgangskode",
      greeting: "Hej {firstName},",
      intro: "Du er inviteret til {companyName}.",
    },
  },
};
const english = {
  Emails: {
    test: {
      subject: "Reset your password (en)",
      greeting: "Hello {firstName},",
      intro: "Welcome to {companyName}.",
    },
  },
};

function input(overrides: Partial<EmailTextsInput>): EmailTextsInput {
  return {
    keys,
    locale: "da",
    chosen: danish,
    english,
    values: { firstName: "Anna", companyName: "Acme" },
    source,
    ...overrides,
  };
}

function withText(document: typeof danish, key: keyof typeof danish.Emails.test, text: string | undefined) {
  const test: Record<string, string> = { ...document.Emails.test };
  if (text === undefined) {
    delete test[key];
  } else {
    test[key] = text;
  }
  return { Emails: { test } };
}

describe("resolveEmailTexts", () => {
  it("uses the chosen language and fills placeholders, with no reports", () => {
    expect(resolveEmailTexts(input({}))).toEqual({
      texts: {
        "Emails.test.subject": "Nulstil din adgangskode",
        "Emails.test.greeting": "Hej Anna,",
        "Emails.test.intro": "Du er inviteret til Acme.",
      },
      fallbacks: [],
    });
  });

  it("falls back to English for one missing text only and reports that key for the chosen language", () => {
    const result = resolveEmailTexts(input({ chosen: withText(danish, "intro", undefined) }));

    expect(result.texts).toEqual({
      "Emails.test.subject": "Nulstil din adgangskode",
      "Emails.test.greeting": "Hej Anna,",
      "Emails.test.intro": "Welcome to Acme.",
    });
    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "da", key: "Emails.test.intro", page_path: source },
    ]);
  });

  it("treats a blank text as missing and uses the built-in copy when English is missing too", () => {
    const result = resolveEmailTexts(
      input({
        chosen: withText(danish, "greeting", "   "),
        english: withText(english, "greeting", undefined),
      })
    );

    expect(result.texts["Emails.test.greeting"]).toBe("Hi Anna,");
    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "da", key: "Emails.test.greeting", page_path: source },
      { kind: "key", locale: "en", key: "Emails.test.greeting", page_path: source },
    ]);
  });

  it("reports only the English key when the chosen language is English", () => {
    const englishWithBlank = withText(english, "subject", "");
    const result = resolveEmailTexts(
      input({ locale: "en", chosen: englishWithBlank, english: englishWithBlank })
    );

    expect(result.texts["Emails.test.subject"]).toBe("Reset your password");
    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "en", key: "Emails.test.subject", page_path: source },
    ]);
  });

  it("uses English texts without reports for the chosen language when its document is unavailable", () => {
    expect(resolveEmailTexts(input({ chosen: null }))).toEqual({
      texts: {
        "Emails.test.subject": "Reset your password (en)",
        "Emails.test.greeting": "Hello Anna,",
        "Emails.test.intro": "Welcome to Acme.",
      },
      fallbacks: [],
    });
  });

  it("uses the built-in copy without English reports when the English document is unavailable", () => {
    const result = resolveEmailTexts(
      input({ chosen: withText(danish, "subject", undefined), english: null })
    );

    expect(result.texts["Emails.test.subject"]).toBe("Reset your password");
    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "da", key: "Emails.test.subject", page_path: source },
    ]);
  });

  it("ignores a group stored where a text is expected, as a missing text", () => {
    const chosen = { Emails: { test: { ...danish.Emails.test, subject: { nested: "x" } } } };
    const result = resolveEmailTexts(input({ chosen }));

    expect(result.texts["Emails.test.subject"]).toBe("Reset your password (en)");
    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "da", key: "Emails.test.subject", page_path: source },
    ]);
  });

  it.each([
    ["an unknown placeholder", "Din adgangskode er {password}"],
    ["an ICU plural", "{count, plural, one {# dag} other {# dage}}"],
    ["a formatted number", "{companyName, number}"],
    ["invalid ICU syntax", "Hej {firstName"],
  ])("moves past a text with %s to the next source without reporting it", (_, text) => {
    const result = resolveEmailTexts(input({ chosen: withText(danish, "intro", text) }));

    expect(result.texts["Emails.test.intro"]).toBe("Welcome to Acme.");
    expect(result.fallbacks).toEqual([]);
  });

  it("moves past an unusable English text to the built-in copy without reporting it", () => {
    const result = resolveEmailTexts(
      input({ chosen: null, english: withText(english, "intro", "Welcome {password}") })
    );

    expect(result.texts["Emails.test.intro"]).toBe("You were invited to Acme.");
    expect(result.fallbacks).toEqual([]);
  });

  it("does not expand placeholders inside a supplied value", () => {
    const result = resolveEmailTexts(
      input({ values: { firstName: "{companyName}", companyName: "Acme {firstName}" } })
    );

    expect(result.texts["Emails.test.greeting"]).toBe("Hej {companyName},");
    expect(result.texts["Emails.test.intro"]).toBe("Du er inviteret til Acme {firstName}.");
  });

  it("returns texts unescaped, keeping markup characters for the builder to escape", () => {
    const result = resolveEmailTexts(
      input({
        chosen: withText(danish, "subject", `Klik "her" & <b>nu</b>`),
        values: { firstName: "<script>alert(1)</script>", companyName: "A&B" },
      })
    );

    expect(result.texts["Emails.test.subject"]).toBe(`Klik "her" & <b>nu</b>`);
    expect(result.texts["Emails.test.greeting"]).toBe("Hej <script>alert(1)</script>,");
  });

  it("puts only the key, locale and source in a report, never a placeholder value", () => {
    const result = resolveEmailTexts(
      input({
        chosen: withText(danish, "greeting", undefined),
        values: { firstName: "anna@example.com", companyName: "Acme" },
      })
    );

    expect(result.fallbacks).toEqual([
      { kind: "key", locale: "da", key: "Emails.test.greeting", page_path: source },
    ]);
    expect(JSON.stringify(result.fallbacks)).not.toContain("anna@example.com");
  });

  it("throws when a built-in copy cannot be filled, since that is a code defect", () => {
    expect(() =>
      resolveEmailTexts(input({ chosen: null, english: null, values: { companyName: "Acme" } }))
    ).toThrow("Emails.test.greeting");
  });
});
