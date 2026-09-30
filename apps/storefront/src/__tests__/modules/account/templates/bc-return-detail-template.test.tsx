import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import BcReturnDetailTemplate from "@/modules/account/templates/bc-return-detail-template"
import type { BCReturnDetail } from "@/types/bc-order"

const bcReturn: BCReturnDetail = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Pending Approval",
  lines: [
    {
      id: "line-30000",
      sequence: 30000,
      lineType: "Item",
      itemNumber: "FVIE-M-BLACK",
      variantCode: "XL",
      description: "Fjeld Vest",
      unitOfMeasureCode: "PCS",
      quantity: 2,
      quantityReceived: 1,
      returnReasonCode: "NORMAL",
    },
  ],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
}

describe("BcReturnDetailTemplate", () => {
  // TC-1: happy path — header fields, decoded BC status and both sections.
  it("renders the return number, requested date, BC status, lines and expected credit", () => {
    render(<BcReturnDetailTemplate bcReturn={bcReturn} />)

    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
    expect(screen.getByText("Requested on")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-document-date")).toHaveTextContent(
      new Date("2026-09-27").toLocaleDateString("en-GB")
    )
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Pending Approval")
    expect(screen.getByTestId("bc-return-lines")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-expected-credit")).toBeInTheDocument()
  })

  // TC-2: wiring — the back link goes to the NIMBUS-140 overview in the current country.
  it("links back to the returns overview", () => {
    render(<BcReturnDetailTemplate bcReturn={bcReturn} />)

    const backLink = screen.getByTestId("bc-return-back-link")
    expect(backLink).toHaveTextContent("Back to returns")
    expect(backLink).toHaveAttribute("href", "/dk/account/returns")
  })

  it("shows a dash when Business Central sends no requested date", () => {
    render(<BcReturnDetailTemplate bcReturn={{ ...bcReturn, documentDate: "" }} />)

    expect(screen.getByTestId("bc-return-document-date")).toHaveTextContent(/^-$/)
  })
})
