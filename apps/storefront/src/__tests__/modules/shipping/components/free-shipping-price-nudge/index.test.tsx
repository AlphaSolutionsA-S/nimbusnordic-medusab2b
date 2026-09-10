import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import FreeShippingPriceNudge from "@/modules/shipping/components/free-shipping-price-nudge"

const priceNotReached = {
  target_reached: false,
  target_remaining: 2000,
  remaining_percentage: 40,
}

const priceReached = {
  ...priceNotReached,
  target_reached: true,
}

describe("FreeShippingPriceNudge", () => {
  it("renders the extracted unlock prompt and remaining message unchanged (inline)", () => {
    render(
      <FreeShippingPriceNudge
        variant="inline"
        cart={{ currency_code: "usd" } as any}
        freeShippingPrices={[priceNotReached as any]}
      />
    )

    expect(screen.getByText("Unlock Free Shipping")).toBeInTheDocument()
    expect(screen.getByText(/Only/)).toBeInTheDocument()
    expect(screen.getByText(/away/)).toBeInTheDocument()
  })

  it("renders the extracted unlocked label unchanged (inline)", () => {
    render(
      <FreeShippingPriceNudge
        variant="inline"
        cart={{ currency_code: "usd" } as any}
        freeShippingPrices={[priceReached as any]}
      />
    )

    expect(screen.getByText("Free Shipping unlocked!")).toBeInTheDocument()
  })

  it("renders the extracted popup action labels unchanged", () => {
    render(
      <FreeShippingPriceNudge
        variant="popup"
        cart={{ currency_code: "usd", items: [{ id: "1" }] } as any}
        freeShippingPrices={[priceNotReached as any]}
      />
    )

    expect(screen.getByText("View cart")).toBeInTheDocument()
    expect(screen.getByText("View Products")).toBeInTheDocument()
  })
})
