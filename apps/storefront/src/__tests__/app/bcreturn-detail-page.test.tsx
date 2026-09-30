import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  retrieveBCReturn: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import { retrieveBCReturn } from "@/lib/data/business-central"
import { notFound } from "next/navigation"
import BCReturnDetailPage from "@/app/[countryCode]/(main)/account/@dashboard/returns/[number]/page"
import BcReturnNotFound from "@/app/[countryCode]/(main)/account/@dashboard/returns/[number]/not-found"

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  state: "open",
  source: "return_order",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
  receipts: [],
}

const processedReturn = {
  ...bcReturn,
  id: "return-order:31502910",
  status: "",
  state: "processed",
  source: "return_order",
  lines: [],
  expectedCredit: null,
  documentDate: "2026-09-28",
  receipts: [
    {
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
    },
  ],
}

describe("BCReturnDetailPage", () => {
  // TC-1: happy path — the return is loaded by the route param and rendered.
  it("renders the return detail template for the requested number", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(bcReturn)

    const element = await BCReturnDetailPage({
      params: Promise.resolve({ number: "31502910" }),
    })
    render(element)

    expect(retrieveBCReturn).toHaveBeenCalledWith("31502910")
    expect(screen.getByTestId("bc-return-detail")).toBeInTheDocument()
    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
  })

  // TC-2: security — foreign/unknown (backend 404 → null) triggers notFound().
  it("calls notFound when the return is not available", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(null)

    await expect(
      BCReturnDetailPage({ params: Promise.resolve({ number: "31502999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  // TC-8 (NIMBUS-172): a processed return is rendered through the page.
  it("renders a processed return with its receipts", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(processedReturn)

    const element = await BCReturnDetailPage({
      params: Promise.resolve({ number: "31502910" }),
    })
    render(element)

    expect(screen.getByTestId("bc-return-detail")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-receipts")).toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
  })

  // TC-3: error condition — BC unavailable shows a friendly error state, not a crash.
  it("renders the error state when loading the return fails", async () => {
    ;(retrieveBCReturn as jest.Mock).mockRejectedValueOnce(new Error("boom"))

    const element = await BCReturnDetailPage({
      params: Promise.resolve({ number: "31502910" }),
    })
    render(element)

    expect(screen.getByTestId("bc-return-detail-error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText("We were unable to load this return. Please try again.")
    ).toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
  })
})

describe("BcReturnNotFound", () => {
  // TC-4 / NIMBUS-172 TC-9: the not-found page is customer-safe, neutral and links back.
  it("renders a non-disclosing message with a link back to the returns overview", async () => {
    const element = await BcReturnNotFound()
    render(element)

    expect(screen.getByText("Return not found")).toBeInTheDocument()
    expect(
      screen.getByText("This return is unavailable. Check the return number and try again.")
    ).toBeInTheDocument()
    expect(screen.queryByText(/fully processed/)).toBeNull()
    expect(screen.getByText("Back to returns")).toHaveAttribute(
      "href",
      "/dk/account/returns"
    )
  })
})
