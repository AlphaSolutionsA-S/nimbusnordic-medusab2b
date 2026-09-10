import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() =>
    Promise.resolve({ id: "customer-1", addresses: [] })
  ),
}))
jest.mock("@/lib/data/regions", () => ({
  getRegion: jest.fn(() => Promise.resolve({ id: "region-1", countries: [] })),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import AddressesPage from "@/app/[countryCode]/(main)/account/@dashboard/addresses/page"

describe("AddressesPage", () => {
  it("renders the extracted heading and description unchanged", async () => {
    const element = await AddressesPage({
      params: Promise.resolve({ countryCode: "us" }),
    })
    render(element)

    expect(screen.getByText("Shipping Addresses")).toBeInTheDocument()
    expect(
      screen.getByText(
        "View and update your shipping addresses, you can add as many as you like. Saving your addresses will make them available during checkout."
      )
    ).toBeInTheDocument()
  })
})
