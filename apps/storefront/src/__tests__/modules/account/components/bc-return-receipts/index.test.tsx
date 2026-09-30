import { render, screen } from "@testing-library/react"

import BcReturnReceipts from "@/modules/account/components/bc-return-receipts"
import type { BCPostedReturnReceipt } from "@/types/bc-order"

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

describe("BcReturnReceipts", () => {
  // TC-1: happy path — the receipt header and its item lines are rendered without prices.
  it("renders the receipt header and its lines", () => {
    render(<BcReturnReceipts receipts={[receipt]} />)

    expect(screen.getByText("Receipts")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-receipt-number")).toHaveTextContent(
      "Receipt #30700011"
    )
    expect(screen.getByTestId("bc-return-receipt-date")).toHaveTextContent(
      new Date("2026-09-28").toLocaleDateString("en-GB")
    )
    expect(screen.getByTestId("bc-return-receipt-external-ref")).toHaveTextContent(
      "RET-3f2a9c1b"
    )

    const lines = screen.getAllByTestId("bc-return-receipt-line")
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent("Fjeld Vest")
    expect(lines[0]).toHaveTextContent("Item no. FVIE-M-BLACK · Variant XL")
    expect(lines[0]).toHaveTextContent("PCS")
    expect(screen.getByTestId("bc-return-receipt-line-quantity")).toHaveTextContent(/^1$/)
    expect(screen.getByTestId("bc-return-receipt-line-reason")).toHaveTextContent("NORMAL")

    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent)
    expect(headers).toEqual(["Item", "Unit", "Quantity", "Reason"])
  })

  // TC-2: edge case — an empty external ref is hidden and an empty receipt shows a message.
  it("hides an empty external ref and shows the empty-lines message", () => {
    render(
      <BcReturnReceipts receipts={[{ ...receipt, externalDocumentNumber: "", lines: [] }]} />
    )

    expect(screen.queryByTestId("bc-return-receipt-external-ref")).toBeNull()
    expect(screen.getByTestId("bc-return-receipt-lines-empty")).toHaveTextContent(
      "This receipt has no item lines."
    )
  })

  // TC-3: several receipts keep their order; the external ref is plain text, never markup.
  it("keeps the receipt order and renders the external ref as plain text", () => {
    const second: BCPostedReturnReceipt = {
      ...receipt,
      number: "30700012",
      externalDocumentNumber: "<b>AX 209475</b>",
    }
    const { container } = render(<BcReturnReceipts receipts={[receipt, second]} />)

    expect(
      screen.getAllByTestId("bc-return-receipt-number").map((el) => el.textContent)
    ).toEqual(["Receipt #30700011", "Receipt #30700012"])
    expect(screen.getAllByTestId("bc-return-receipt-external-ref")[1].textContent).toBe(
      "<b>AX 209475</b>"
    )
    expect(container.querySelector("b")).toBeNull()
  })
})
