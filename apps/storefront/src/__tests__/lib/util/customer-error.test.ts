import {
  CART_NOT_FOUND_ERROR,
  getCustomerErrorKey,
  logCustomerError,
} from "@/lib/util/customer-error"

describe("getCustomerErrorKey", () => {
  it.each([
    new Error(CART_NOT_FOUND_ERROR),
    new Error(`Error: ${CART_NOT_FOUND_ERROR}`),
    CART_NOT_FOUND_ERROR,
  ])("maps %p to cartNotFound (TC-1)", (error) => {
    expect(getCustomerErrorKey(error)).toBe("cartNotFound")
  })

  it.each([
    new Error("Promotion code X is invalid."),
    undefined,
    { foo: 1 },
    new Error("An error occurred in the Server Components render."),
  ])("maps %p to generic (TC-2)", (error) => {
    expect(getCustomerErrorKey(error)).toBe("generic")
  })
})

describe("logCustomerError", () => {
  it("logs only context and message (TC-3)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    const err = Object.assign(new Error("boom"), { email: "a@b.c" })

    logCustomerError("checkout.shipping", err)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith("[customer-error]", {
      context: "checkout.shipping",
      message: "boom",
    })
    expect(JSON.stringify(spy.mock.calls)).not.toContain("a@b.c")
    spy.mockRestore()
  })
})
