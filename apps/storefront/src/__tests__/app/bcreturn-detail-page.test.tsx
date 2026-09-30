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
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
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

  // TC-2: security — foreign/unknown/processed (backend 404 → null) triggers notFound().
  it("calls notFound when the return is not available", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(null)

    await expect(
      BCReturnDetailPage({ params: Promise.resolve({ number: "31502999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(1)
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
  // TC-4: the not-found page is customer-safe and links back to the overview.
  it("renders a non-disclosing message with a link back to the returns overview", async () => {
    const element = await BcReturnNotFound()
    render(element)

    expect(screen.getByText("Return not found")).toBeInTheDocument()
    expect(
      screen.getByText(
        "This return is unavailable. Returns that have been fully processed are no longer shown here."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Back to returns")).toHaveAttribute(
      "href",
      "/dk/account/returns"
    )
  })
})
