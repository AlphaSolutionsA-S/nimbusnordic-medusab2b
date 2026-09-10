import { render, screen } from "@testing-library/react"

import PaymentTest from "@/modules/checkout/components/payment-test"

describe("PaymentTest", () => {
  it("renders the extracted strings unchanged", () => {
    render(<PaymentTest />)

    expect(screen.getByText("Attention:")).toBeInTheDocument()
    expect(
      screen.getByText(/For testing purposes only\./)
    ).toBeInTheDocument()
  })
})
