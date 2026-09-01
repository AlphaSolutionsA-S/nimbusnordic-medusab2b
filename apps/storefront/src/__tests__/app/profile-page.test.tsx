import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() =>
    Promise.resolve({ id: "customer-1", first_name: "Jane", last_name: "Doe" })
  ),
  updateCustomer: jest.fn(),
  updatePassword: jest.fn(),
}))
jest.mock("@/lib/data/regions", () => ({
  listRegions: jest.fn(() => Promise.resolve([{ id: "region-1" }])),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ refresh: jest.fn() })),
}))

import Profile from "@/app/[countryCode]/(main)/account/@dashboard/profile/page"

describe("Profile page", () => {
  it("renders the extracted section headings unchanged", async () => {
    const element = await Profile()
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
    expect(screen.getByText("Security")).toBeInTheDocument()
  })
})
