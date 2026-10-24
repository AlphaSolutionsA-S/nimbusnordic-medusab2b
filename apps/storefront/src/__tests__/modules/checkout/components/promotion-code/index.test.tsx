import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { usePathname } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/cart"),
}))

jest.mock("@/lib/data/cart", () => ({
  submitPromotionForm: jest.fn(),
}))

import { submitPromotionForm } from "@/lib/data/cart"
import PromotionCode from "@/modules/checkout/components/promotion-code"

const submitMock = jest.mocked(submitPromotionForm)
const ERROR_TEXT =
  "This code could not be applied. Check the code and try again."
const oneManual = {
  promotions: [
    { id: "p1", code: "SAVE10", is_automatic: false },
    { id: "p2", code: "AUTO5", is_automatic: true },
  ],
} as B2BCart
const emptyCart: B2BCart = { ...oneManual, promotions: [] }
const twoManual = {
  promotions: [
    { id: "p1", code: "SAVE10", is_automatic: false },
    { id: "p2", code: "SAVE20", is_automatic: false },
  ],
} as B2BCart

function lastFormData(): FormData {
  return submitMock.mock.calls[submitMock.mock.calls.length - 1][1]
}

async function applyCode(value: string) {
  await userEvent.click(screen.getByTestId("add-discount-button"))
  await userEvent.type(screen.getByTestId("discount-input"), value)
  await userEvent.click(screen.getByRole("button", { name: "Apply" }))
}

describe("PromotionCode", () => {
  beforeEach(() => {
    submitMock.mockReset()
    submitMock.mockResolvedValue({ success: true })
    ;(usePathname as jest.Mock).mockReturnValue("/us/cart")
  })

  it("renders the extracted toggle label and reveals the 'Apply' button unchanged", () => {
    const cart = { promotions: [] } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    fireEvent.click(
      screen.getByRole("button", { name: /Enter Promotion Code/ })
    )

    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument()
  })

  it("renders the extracted singular/plural 'applied' heading unchanged", () => {
    const cart = {
      promotions: [{ id: "promo-1", code: "SAVE10", is_automatic: true }],
    } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    expect(screen.getByText("Promotion applied:")).toBeInTheDocument()
  })

  it("renders the extracted plural heading when multiple promotions are applied", () => {
    const cart = {
      promotions: [
        { id: "promo-1", code: "SAVE10", is_automatic: true },
        { id: "promo-2", code: "SAVE20", is_automatic: true },
      ],
    } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    expect(screen.getByText("Promotions applied:")).toBeInTheDocument()
  })

  it("shows the translated error after a failed form submission and keeps the typed code", async () => {
    submitMock.mockResolvedValue({ success: false })
    render(<PromotionCode cart={emptyCart} />)
    await applyCode("DOESNOTEXIST")
    expect(
      await screen.findByTestId("discount-error-message")
    ).toHaveTextContent(ERROR_TEXT)
    expect(screen.queryByText(/is invalid/)).not.toBeInTheDocument()
    expect(submitMock).toHaveBeenCalledTimes(1)
    expect(lastFormData().get("code")).toBe("DOESNOTEXIST")
    expect(screen.getByTestId("discount-input")).toHaveValue("DOESNOTEXIST")
  })

  it("clears the input and the earlier error when a retry succeeds", async () => {
    submitMock.mockResolvedValueOnce({ success: false })
    render(<PromotionCode cart={emptyCart} />)
    await applyCode("SAVE10")
    await screen.findByTestId("discount-error-message")
    await userEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() =>
      expect(screen.getByTestId("discount-input")).toHaveValue("")
    )
    expect(
      screen.queryByTestId("discount-error-message")
    ).not.toBeInTheDocument()
  })

  it("submits existing manual codes with an added code but excludes automatic promotions", async () => {
    render(<PromotionCode cart={oneManual} />)
    await applyCode("NEW20")
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(lastFormData().getAll("applied_code")).toEqual(["SAVE10"])
    expect(lastFormData().get("code")).toBe("NEW20")
    expect(lastFormData().has("remove_code")).toBe(false)
  })

  it("submits all manual codes and the chosen code when removing one of several", async () => {
    render(<PromotionCode cart={twoManual} />)
    await userEvent.click(screen.getAllByTestId("remove-discount-button")[0])
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(lastFormData().getAll("applied_code")).toEqual(["SAVE10", "SAVE20"])
    expect(lastFormData().get("remove_code")).toBe("SAVE10")
  })

  it("submits removal of the only manual code without a removal control for automatic promotions", async () => {
    render(<PromotionCode cart={oneManual} />)
    await userEvent.click(screen.getByTestId("remove-discount-button"))
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(lastFormData().getAll("applied_code")).toEqual(["SAVE10"])
    expect(lastFormData().get("remove_code")).toBe("SAVE10")
  })

  it("shows one translated error for a failed removal with the add form closed", async () => {
    submitMock.mockResolvedValue({ success: false })
    render(<PromotionCode cart={twoManual} />)
    await userEvent.click(screen.getAllByTestId("remove-discount-button")[0])
    expect(
      await screen.findByTestId("discount-error-message")
    ).toHaveTextContent(ERROR_TEXT)
    expect(screen.getAllByTestId("discount-error-message")).toHaveLength(1)
  })

  it("shows a failed removal when approval hides the add form", async () => {
    submitMock.mockResolvedValue({ success: false })
    const cart = {
      ...twoManual,
      approvals: [{ id: "a1", status: "pending", type: "admin" }],
    } as B2BCart
    render(<PromotionCode cart={cart} />)
    expect(screen.queryByTestId("add-discount-button")).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByTestId("remove-discount-button")[0])
    expect(
      await screen.findByTestId("discount-error-message")
    ).toHaveTextContent(ERROR_TEXT)
  })

  it("preserves a draft on successful removal and clears the previous add error", async () => {
    submitMock.mockResolvedValueOnce({ success: false })
    render(<PromotionCode cart={twoManual} />)
    await applyCode("DRAFT")
    await screen.findByTestId("discount-error-message")
    await userEvent.click(screen.getAllByTestId("remove-discount-button")[0])
    await waitFor(() =>
      expect(
        screen.queryByTestId("discount-error-message")
      ).not.toBeInTheDocument()
    )
    expect(screen.getByTestId("discount-input")).toHaveValue("DRAFT")
  })

  it("offers no remove control for a manual promotion without a code", () => {
    const cart = { promotions: [{ id: "p1", is_automatic: false }] } as B2BCart
    render(<PromotionCode cart={cart} />)
    expect(
      screen.queryByTestId("remove-discount-button")
    ).not.toBeInTheDocument()
  })
})
