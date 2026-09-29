jest.mock("@/lib/data/cart", () => ({
  addToCartBulk: jest.fn(),
  deleteLineItem: jest.fn(),
  emptyCart: jest.fn(),
  updateLineItem: jest.fn(),
}))
jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { registerCartAddHandler: jest.fn() },
}))
jest.mock("next/navigation", () => ({ useParams: jest.fn(() => ({ countryCode: "gb" })) }))
jest.mock("@medusajs/ui", () => ({
  ...jest.requireActual("@medusajs/ui"),
  toast: { error: jest.fn() },
}))

import { act, render, waitFor } from "@testing-library/react"
import { toast } from "@medusajs/ui"
import { useEffect } from "react"

import { deleteLineItem } from "@/lib/data/cart"
import { CartProvider, useCart } from "@/lib/context/cart-context"
import type { B2BCart } from "@/types/global"

// jsdom has no structuredClone, which the provider's optimistic updates use.
globalThis.structuredClone ??= ((value: unknown) =>
  JSON.parse(JSON.stringify(value))) as typeof structuredClone

const cart = {
  id: "cart_1",
  items: [{ id: "item_1", quantity: 1, unit_price: 10, created_at: "2026-01-01" }],
} as unknown as B2BCart

function DeleteOnMount() {
  const { handleDeleteItem } = useCart()
  useEffect(() => {
    void handleDeleteItem("item_1")
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount
  return null
}

describe("CartProvider toasts", () => {
  it("shows the translated delete-failure toast (TC-3)", async () => {
    ;(deleteLineItem as jest.Mock).mockRejectedValueOnce(new Error("backend text"))

    await act(async () => {
      render(
        <CartProvider cart={cart}>
          <DeleteOnMount />
        </CartProvider>
      )
    })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to delete item")
    )
  })
})
