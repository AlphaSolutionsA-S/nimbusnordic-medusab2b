import { render, screen } from "@testing-library/react"

import QuoteStatusBadge from "@/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-status-badge"

describe("QuoteStatusBadge", () => {
  it("renders the extracted status labels unchanged", () => {
    const { rerender } = render(<QuoteStatusBadge status="accepted" />)
    expect(screen.getByText("Accepted")).toBeInTheDocument()

    rerender(<QuoteStatusBadge status="pending_merchant" />)
    expect(screen.getByText("Pending Merchant")).toBeInTheDocument()

    rerender(<QuoteStatusBadge status="customer_rejected" />)
    expect(screen.getByText("Customer Rejected")).toBeInTheDocument()
  })
})
