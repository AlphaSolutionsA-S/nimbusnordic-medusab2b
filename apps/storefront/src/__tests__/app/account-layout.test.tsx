jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(),
}))
jest.mock("next/headers", () => ({ headers: jest.fn() }))

import { retrieveCustomer } from "@/lib/data/customer"
import { headers } from "next/headers"
import { render, screen } from "@testing-library/react"
import AccountPageLayout from "@/app/[countryCode]/(main)/account/layout"

const mockRetrieveCustomer = retrieveCustomer as jest.Mock
const mockHeaders = headers as jest.Mock

describe("account layout slot choice", () => {
  beforeEach(() => {
    mockHeaders.mockResolvedValue(new Headers())
  })

  it("renders the dashboard slot, never the login slot, for a signed-in customer", async () => {
    mockRetrieveCustomer.mockResolvedValue({ id: "cus_1" })

    const element = await AccountPageLayout({
      dashboard: <div>dashboard slot</div>,
      login: <div>login slot</div>,
    })
    render(element)

    expect(screen.getByText("dashboard slot")).toBeInTheDocument()
    expect(screen.queryByText("login slot")).not.toBeInTheDocument()
  })

  it("renders the login slot for a signed-out visitor", async () => {
    mockRetrieveCustomer.mockResolvedValue(null)

    const element = await AccountPageLayout({
      dashboard: <div>dashboard slot</div>,
      login: <div>login slot</div>,
    })
    render(element)

    expect(screen.getByText("login slot")).toBeInTheDocument()
    expect(screen.queryByText("dashboard slot")).not.toBeInTheDocument()
  })
})
