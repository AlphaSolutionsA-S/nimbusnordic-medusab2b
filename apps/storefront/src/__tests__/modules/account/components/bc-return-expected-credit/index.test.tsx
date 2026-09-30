import { render, screen } from "@testing-library/react"

import { convertToLocale } from "@/lib/util/money"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"

// jest-dom normalises the rendered text's whitespace (Intl uses U+00A0 after the currency code).
const money = (amount: number, currencyCode: string) =>
  convertToLocale({ amount, currency_code: currencyCode, locale: "en" }).replace(/\s/g, " ")

describe("BcReturnExpectedCredit", () => {
  // TC-1: happy path — both totals in the return's currency, labelled as expected.
  it("renders the expected credit excluding and including tax with the disclaimer", () => {
    render(
      <BcReturnExpectedCredit
        expectedCredit={{
          currencyCode: "DKK",
          amountIncludingTax: 1598.75,
          amountExcludingTax: 1279,
        }}
      />
    )

    expect(screen.getByText("Expected credit")).toBeInTheDocument()
    expect(screen.getByText("Expected credit excluding tax")).toBeInTheDocument()
    expect(screen.getByText("Expected credit including tax")).toBeInTheDocument()
    expect(
      screen.getByTestId("bc-return-expected-credit-excluding-tax")
    ).toHaveTextContent(money(1279, "DKK"))
    expect(
      screen.getByTestId("bc-return-expected-credit-including-tax")
    ).toHaveTextContent(money(1598.75, "DKK"))
    expect(screen.getByTestId("bc-return-expected-credit-disclaimer")).toHaveTextContent(
      "This amount is an estimate based on the return order. The final amount is set on the credit note."
    )
  })

  // TC-2: edge case — prices incl. VAT: no net figure, only the incl.-tax amount.
  it("hides the excluding-tax amount when it is null", () => {
    render(
      <BcReturnExpectedCredit
        expectedCredit={{
          currencyCode: "SEK",
          amountIncludingTax: 500,
          amountExcludingTax: null,
        }}
      />
    )

    expect(screen.queryByTestId("bc-return-expected-credit-excluding-tax")).toBeNull()
    expect(
      screen.getByTestId("bc-return-expected-credit-including-tax")
    ).toHaveTextContent(money(500, "SEK"))
  })
})
