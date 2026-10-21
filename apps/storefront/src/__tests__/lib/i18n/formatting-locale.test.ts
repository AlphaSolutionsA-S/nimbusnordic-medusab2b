import { getFormattingLocale } from "@/lib/i18n/formatting-locale"

// The formatting tags the eight original languages had before languages became configurable;
// they must not change (NIMBUS-176).
const LEGACY_TAGS: Record<string, string> = {
  da: "da-DK",
  en: "en-GB",
  sv: "sv-SE",
  no: "nb-NO",
  pl: "pl-PL",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
}

describe("getFormattingLocale", () => {
  it.each(Object.entries(LEGACY_TAGS))(
    "keeps %s formatted as %s",
    (locale, tag) => {
      expect(getFormattingLocale(locale)).toBe(tag)
    }
  )

  it("only returns tags Intl supports for the original languages", () => {
    const tags = Object.keys(LEGACY_TAGS).map(getFormattingLocale)
    expect(Intl.NumberFormat.supportedLocalesOf(tags)).toEqual(tags)
  })

  it.each([
    ["nl", "nl"],
    ["pt-BR", "pt-BR"],
    ["zh-Hant", "zh-Hant"],
    ["zh-Hant-TW", "zh-Hant-TW"],
    ["sr-Latn-RS", "sr-Latn-RS"],
  ])("uses a valid new language tag %s directly", (locale, tag) => {
    expect(getFormattingLocale(locale)).toBe(tag)
  })

  it("canonicalizes a valid tag written in another case", () => {
    expect(getFormattingLocale("pt-br")).toBe("pt-BR")
  })

  it("formats numbers with the new language's conventions", () => {
    expect(
      new Intl.NumberFormat(getFormattingLocale("nl")).format(1234.5)
    ).toBe("1.234,5")
  })

  it.each(["", "en_GB", "en-", "../en", "en GB", "x".repeat(65)])(
    "falls back to en-GB for the malformed tag %p",
    (locale) => {
      expect(getFormattingLocale(locale)).toBe("en-GB")
    }
  )

  it.each(["__proto__", "constructor"])(
    "never returns an inherited object property for %p",
    (locale) => {
      expect(typeof getFormattingLocale(locale)).toBe("string")
      expect(getFormattingLocale(locale)).toBe("en-GB")
    }
  )
})
