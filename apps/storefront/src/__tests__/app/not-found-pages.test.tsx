import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import MainNotFound from "@/app/[countryCode]/(main)/not-found"
import CheckoutNotFound from "@/app/[countryCode]/(checkout)/not-found"
import CartNotFound from "@/app/[countryCode]/(main)/cart/not-found"
import BcOrderNotFound from "@/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/not-found"

describe("not-found pages", () => {
  it("renders the extracted copy for the main not-found page unchanged", async () => {
    const element = await MainNotFound()
    render(element)

    expect(screen.getByText("Page not found")).toBeInTheDocument()
    expect(
      screen.getByText("The page you tried to access does not exist.")
    ).toBeInTheDocument()
    expect(screen.getByText("Go to frontpage")).toBeInTheDocument()
  })

  it("renders the extracted copy for the checkout not-found page unchanged", async () => {
    const element = await CheckoutNotFound()
    render(element)

    expect(screen.getByText("Page not found")).toBeInTheDocument()
    expect(
      screen.getByText("The page you tried to access does not exist.")
    ).toBeInTheDocument()
    expect(screen.getByText("Go to frontpage")).toBeInTheDocument()
  })

  it("renders the extracted copy for the cart not-found page unchanged", async () => {
    const element = await CartNotFound()
    render(element)

    expect(screen.getByText("Page not found")).toBeInTheDocument()
    expect(
      screen.getByText(
        "The cart you tried to access does not exist. Clear your cookies and try again."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Go to frontpage")).toBeInTheDocument()
  })

  it("renders the extracted copy for the bc-order not-found page unchanged", async () => {
    const element = await BcOrderNotFound()
    render(element)

    expect(screen.getByText("Order not found")).toBeInTheDocument()
    expect(screen.getByText("This order is unavailable.")).toBeInTheDocument()
    expect(screen.getByText("Back to BC orders")).toBeInTheDocument()
  })
})
