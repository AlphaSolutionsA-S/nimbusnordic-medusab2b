import { render, screen } from "@testing-library/react"
import type { B2BCustomer } from "@/types/global"

const customer = {
  first_name: "Jane",
  email: "jane@example.com",
  addresses: [],
} as unknown as B2BCustomer

import Overview from "@/modules/account/components/overview"

describe("Overview", () => {
  it("renders all extracted strings unchanged", async () => {
    const element = await Overview({ customer, orders: [] })
    render(element)

    expect(screen.getByText("Hello Jane")).toBeInTheDocument()
    expect(screen.getByText(/Signed in as:/)).toBeInTheDocument()
    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByText("Addresses")).toBeInTheDocument()
    expect(screen.getByText("Saved")).toBeInTheDocument()
    expect(screen.getByText("Recent orders")).toBeInTheDocument()
    expect(screen.getByText("No recent orders")).toBeInTheDocument()
    expect(
      screen.getByText("Previously purchased items")
    ).toBeInTheDocument()
    expect(
      screen.getByText("No previously purchased items")
    ).toBeInTheDocument()
  })
})
