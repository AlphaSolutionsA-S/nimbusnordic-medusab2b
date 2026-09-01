import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))
// MedusaCTA is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element,
// and it's irrelevant to what this test covers (the layout's own brand text).
jest.mock("@/modules/layout/components/medusa-cta", () => () => null)

import CheckoutLayout from "@/app/[countryCode]/(checkout)/layout"

describe("CheckoutLayout", () => {
  it("renders the reused brand name unchanged", async () => {
    const element = await CheckoutLayout({ children: <div>content</div> })
    render(element)

    expect(screen.getByText("Medusa B2B Starter")).toBeInTheDocument()
  })
})
