import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import BcReturnDetailTemplate from "@/modules/account/templates/bc-return-detail-template"
import type { BCPostedReturnReceipt, BCReturnDetail } from "@/types/bc-order"

const bcReturn: BCReturnDetail = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Pending Approval",
  state: "open",
  source: "return_order",
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
  receipts: [],
}

const receipt: BCPostedReturnReceipt = {
  number: "30700011",
  receivedDate: "2026-09-28",
  externalDocumentNumber: "RET-3f2a9c1b",
  lines: [
    {
      lineNumber: 30000,
      itemNumber: "FVIE-M-BLACK",
      variantCode: "XL",
      description: "Fjeld Vest",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      returnReasonCode: "NORMAL",
    },
  ],
}

const processedReturn: BCReturnDetail = {
  ...bcReturn,
  id: "return-order:31502910",
  status: "",
  state: "processed",
  source: "return_order",
  lines: [],
  expectedCredit: null,
  documentDate: "2026-09-28",
  receipts: [receipt],
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

  // TC-4 (NIMBUS-172): an open return with partial receipts shows the order sections and receipts.
  it("shows the order sections and the receipts of a partly received open return", () => {
    render(<BcReturnDetailTemplate bcReturn={{ ...bcReturn, receipts: [receipt] }} />)

    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-document-date")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Open")
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Pending Approval")
    expect(screen.getByTestId("bc-return-lines")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-expected-credit")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-receipts")).toBeInTheDocument()
  })

  // TC-5 (NIMBUS-172): a processed return order shows only the receipts.
  it("shows only the receipts of a processed return order", () => {
    render(<BcReturnDetailTemplate bcReturn={processedReturn} />)

    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Processed")
    expect(screen.queryByTestId("bc-return-status")).toBeNull()
    expect(screen.queryByTestId("bc-return-document-date")).toBeNull()
    expect(screen.queryByTestId("bc-return-lines")).toBeNull()
    expect(screen.queryByTestId("bc-return-expected-credit")).toBeNull()
    expect(screen.getByTestId("bc-return-receipts")).toBeInTheDocument()
  })

  // TC-6 (NIMBUS-172): a stand-alone receipt uses the receipt heading.
  it("uses the receipt heading for a stand-alone receipt", () => {
    render(
      <BcReturnDetailTemplate
        bcReturn={{
          ...processedReturn,
          id: "posted-receipt:30700003",
          number: "30700003",
          source: "posted_receipt",
        }}
      />
    )

    expect(screen.getByText("Return receipt #30700003")).toBeInTheDocument()
    expect(screen.queryByText("Return #30700003")).toBeNull()
  })

  // TC-7 (NIMBUS-172): an open return whose BC status is "Open" shows only the state badge.
  it("shows only the state badge when the BC status is Open", () => {
    render(<BcReturnDetailTemplate bcReturn={{ ...bcReturn, status: "Open" }} />)

    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Open")
    expect(screen.queryByTestId("bc-return-status")).toBeNull()
    expect(screen.queryByTestId("bc-return-receipts")).toBeNull()
  })
})
