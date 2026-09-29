import { renderHook } from "@testing-library/react"

import { useCustomerErrorMessage } from "@/lib/hooks/use-customer-error-message"

describe("useCustomerErrorMessage", () => {
  it("returns translated text and logs the raw message (TC-4)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    const { result } = renderHook(() => useCustomerErrorMessage())

    expect(result.current(new Error("raw backend text"), "test")).toBe(
      "Something went wrong. Please try again."
    )
    expect(spy).toHaveBeenCalled()
    expect(result.current(new Error("CART_NOT_FOUND"), "test")).toBe(
      "We couldn't find your cart. Please refresh the page and try again."
    )
    spy.mockRestore()
  })
})
