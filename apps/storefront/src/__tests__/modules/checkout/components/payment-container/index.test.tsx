import { RadioGroup } from "@headlessui/react"
import { render, screen } from "@testing-library/react"

import { paymentInfoMap } from "@/lib/constants"
import PaymentContainer from "@/modules/checkout/components/payment-container"

describe("PaymentContainer", () => {
  it("shows the translated title for a known provider (TC-1)", () => {
    render(
      <RadioGroup>
        <PaymentContainer
          paymentProviderId="pp_system_default"
          paymentInfoMap={paymentInfoMap}
          selectedPaymentOptionId={null}
        />
      </RadioGroup>
    )

    expect(screen.getByText("Pay by invoice")).toBeInTheDocument()
  })

  it("falls back to the provider id for an unknown provider (TC-2)", () => {
    render(
      <RadioGroup>
        <PaymentContainer
          paymentProviderId="pp_unknown"
          paymentInfoMap={paymentInfoMap}
          selectedPaymentOptionId={null}
        />
      </RadioGroup>
    )

    expect(screen.getByText("pp_unknown")).toBeInTheDocument()
  })
})
