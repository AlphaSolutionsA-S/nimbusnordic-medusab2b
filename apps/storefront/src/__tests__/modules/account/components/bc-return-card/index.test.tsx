import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcReturnCard from "@/modules/account/components/bc-return-card"
import type { BCReturnListItem } from "@/types/bc-order"

const item = {
  id: "ro-guid-1",
  number: "RET-1",
  documentDate: "2026-01-01T00:00:00.000Z",
  status: "Open",
  state: "open",
  source: "return_order",
  itemCount: 2,
  receipts: [],
} as BCReturnListItem

describe("BcReturnCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  // TC-1: happy path — the details link routes by the return number.
  it("links to the return detail page using the return number, not the internal id", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/RET-1")
    )
    expect(detailsLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/ro-guid-1")
    )
  })

  // TC-2: edge case — a return number containing characters that need URL-encoding still produces a safe link.
  it("URL-encodes a return number that contains characters unsafe for a path segment", async () => {
    const encodedItem = { ...item, number: "RET/1 2" }
    const element = await BcReturnCard({ item: encodedItem })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("RET/1 2"))
    )
  })

  // TC-3 / NIMBUS-172 TC-5: the Open state badge replaces a redundant "Open" BC status.
  it("renders return number, state badge, date and item count", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByTestId("bc-return-number")).toHaveTextContent("RET-1")
    expect(screen.getByTestId("bc-return-date")).not.toBeEmptyDOMElement()
    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Open")
    expect(screen.queryByTestId("bc-return-status")).toBeNull()
    expect(screen.getByTestId("bc-return-item-count")).toHaveTextContent("Items: 2")
  })

  // TC-4: regression guard — no related-order column (External Document No. is the portal requestId).
  it("does not render a related order number", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.queryByTestId("bc-return-related-order")).toBeNull()
  })

  it("shows a dash when Business Central sends no document date", async () => {
    const element = await BcReturnCard({ item: { ...item, documentDate: "" } })
    render(element)

    expect(screen.getByTestId("bc-return-date")).toHaveTextContent(/^-$/)
  })

  // TC-6 (NIMBUS-172): an informative BC status is kept for open returns.
  it("keeps an informative BC status next to the Open badge", async () => {
    const element = await BcReturnCard({ item: { ...item, status: "Released" } })
    render(element)

    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Open")
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Released")
  })

  // TC-7 (NIMBUS-172): a processed return order shows its grouped receipts.
  it("shows the Processed badge and the grouped receipts of a processed return order", async () => {
    const element = await BcReturnCard({
      item: {
        ...item,
        id: "return-order:31400001",
        number: "31400001",
        status: "",
        state: "processed",
        source: "return_order",
        itemCount: 1,
        receipts: [
          { number: "30700005", receivedDate: "2026-08-10", externalDocumentNumber: "" },
          { number: "30700007", receivedDate: "2026-08-15", externalDocumentNumber: "AX 209475" },
        ],
      },
    })
    render(element)

    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Processed")
    expect(screen.queryByTestId("bc-return-status")).toBeNull()
    expect(screen.getAllByTestId("bc-return-receipt")).toHaveLength(2)
    expect(
      screen.getAllByTestId("bc-return-receipt-number").map((el) => el.textContent)
    ).toEqual(["Receipt #30700005", "Receipt #30700007"])
    expect(screen.getAllByTestId("bc-return-receipt-date")[0]).not.toBeEmptyDOMElement()
    const externalRefs = screen.getAllByTestId("bc-return-receipt-external-ref")
    expect(externalRefs).toHaveLength(1)
    expect(externalRefs[0]).toHaveTextContent("AX 209475")
    expect(screen.getByTestId("bc-return-details-link")).toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/31400001")
    )
  })

  // TC-8 (NIMBUS-172): receipts are listed under a partly received open return order.
  it("lists the receipts of a partly received open return order", async () => {
    const element = await BcReturnCard({
      item: {
        ...item,
        receipts: [
          { number: "30700010", receivedDate: "2026-09-25", externalDocumentNumber: "RET-3f2a9c1b" },
        ],
      },
    })
    render(element)

    expect(screen.getByTestId("bc-return-state")).toHaveTextContent("Open")
    expect(screen.getAllByTestId("bc-return-receipt")).toHaveLength(1)
    expect(screen.getByTestId("bc-return-receipt-external-ref")).toHaveTextContent(
      "RET-3f2a9c1b"
    )
    expect(screen.getByTestId("bc-return-number")).toHaveTextContent("#RET-1")
  })

  // TC-9 (NIMBUS-172): a stand-alone receipt shows its external ref inline.
  it("shows the external ref of a stand-alone receipt without a receipts list", async () => {
    const element = await BcReturnCard({
      item: {
        ...item,
        id: "posted-receipt:30700003",
        number: "30700003",
        status: "",
        state: "processed",
        source: "posted_receipt",
        itemCount: 1,
        receipts: [
          { number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" },
        ],
      },
    })
    render(element)

    expect(screen.getByTestId("bc-return-external-ref")).toHaveTextContent("AX 209475")
    expect(screen.queryByTestId("bc-return-receipts")).toBeNull()
    expect(screen.getByTestId("bc-return-details-link")).toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/30700003")
    )
  })

  // TC-10 (NIMBUS-172): the external ref is rendered as plain text, never as markup.
  it("renders the external ref as plain text", async () => {
    const markup = "<img src=x onerror=alert(1)>"
    const element = await BcReturnCard({
      item: {
        ...item,
        id: "posted-receipt:30700003",
        number: "30700003",
        status: "",
        state: "processed",
        source: "posted_receipt",
        receipts: [
          { number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: markup },
        ],
      },
    })
    const { container } = render(element)

    expect(screen.getByTestId("bc-return-external-ref").textContent).toBe(markup)
    expect(container.querySelector("img")).toBeNull()
  })
})
