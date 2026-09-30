import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import { SUPPORTED_LOCALES } from "@/lib/i18n/country-language-map"

const EXPECTED: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
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
  it.each(SUPPORTED_LOCALES)("maps %s to its formatting tag (TC-1)", (locale) => {
    expect(getFormattingLocale(locale)).toBe(EXPECTED[locale])
  })

  it.each(["xx", ""])("falls back to en-GB for unknown locale %p (TC-2)", (locale) => {
    expect(getFormattingLocale(locale)).toBe("en-GB")
  })

  it("only returns tags Intl supports (TC-3)", () => {
    const tags = SUPPORTED_LOCALES.map(getFormattingLocale)
    expect(Intl.NumberFormat.supportedLocalesOf(tags)).toEqual(tags)
  })
})
