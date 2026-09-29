import { convertToLocale } from "@/lib/util/money"

const normalise = (value: string) => value.replace(/\s/g, " ")

describe("convertToLocale", () => {
  it("formats Danish style for the da locale (TC-4)", () => {
    expect(
      convertToLocale({ amount: 1234.5, currency_code: "dkk", locale: "da" })
    ).toMatch(/^1\.234,50\s?kr\.$/)
  })

  it("formats en as en-GB (TC-5)", () => {
    expect(
      normalise(
        convertToLocale({ amount: 1234.5, currency_code: "dkk", locale: "en" })
      )
    ).toBe("DKK 1,234.50")
    expect(
      convertToLocale({ amount: 100, currency_code: "usd", locale: "en" })
    ).toBe("US$100.00")
  })

  it("returns the raw amount without a currency code (TC-6)", () => {
    expect(
      convertToLocale({ amount: 1234.5, currency_code: "", locale: "da" })
    ).toBe("1234.5")
  })

  it("falls back to en-GB for an unknown locale (TC-6)", () => {
    expect(
      convertToLocale({ amount: 1234.5, currency_code: "eur", locale: "xx" })
    ).toBe("€1,234.50")
  })
})
