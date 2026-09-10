import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { B2BCustomer } from "@/types/global"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import AccountButton from "@/modules/account/components/account-button"

describe("AccountButton", () => {
  it("renders the extracted 'Log in' fallback label when there is no customer", async () => {
    const element = await AccountButton({ customer: null })
    render(element)

    expect(screen.getByText("Log in")).toBeInTheDocument()
  })

  it("renders the customer's first name (data-sourced, unchanged) when logged in", async () => {
    const customer = { first_name: "Jane" } as B2BCustomer
    const element = await AccountButton({ customer })
    render(element)

    expect(screen.getByText("Jane")).toBeInTheDocument()
  })
})
