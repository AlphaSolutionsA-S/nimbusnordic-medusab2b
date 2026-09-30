import { makeTranslationErrorHandlers } from "@/lib/i18n/translation-errors"

// The real factory, exercised with next-intl-shaped error objects (the package itself is mocked in
// this Jest setup, so its error class is not constructed here).
function intlError(code: string, message = "internal detail {secret}") {
  return Object.assign(new Error(message), { code, originalMessage: message })
}

type Handlers = ReturnType<typeof makeTranslationErrorHandlers>
type IntlErrorArg = Parameters<Handlers["onError"]>[0]

function setup(available = true) {
  const onMissing = jest.fn()
  const onFormattingError = jest.fn()
  const handlers = makeTranslationErrorHandlers({ available, onMissing, onFormattingError })
  return { handlers, onMissing, onFormattingError }
}

describe("makeTranslationErrorHandlers", () => {
  it("TC-4: returns the full raw key and reports the exact missing key", () => {
    const { handlers, onMissing, onFormattingError } = setup()
    const error = intlError("MISSING_MESSAGE") as unknown as IntlErrorArg
    handlers.onError(error)
    const fallback = handlers.getMessageFallback({ namespace: "Checkout.address", key: "title", error })
    expect(fallback).toBe("Checkout.address.title")
    expect(onMissing).toHaveBeenCalledWith("Checkout.address.title")
    expect(onFormattingError).not.toHaveBeenCalled()
  })

  it("TC-4: joins only non-empty parts for keys without a namespace", () => {
    const { handlers } = setup()
    const error = intlError("MISSING_MESSAGE") as unknown as IntlErrorArg
    expect(handlers.getMessageFallback({ namespace: undefined, key: "status.shipped", error })).toBe(
      "status.shipped"
    )
  })

  it("TC-4: reports formatting errors by code only and still renders the key", () => {
    const { handlers, onMissing, onFormattingError } = setup()
    const error = intlError("FORMATTING_ERROR") as unknown as IntlErrorArg
    handlers.onError(error)
    expect(handlers.getMessageFallback({ namespace: "Cart", key: "items", error })).toBe("Cart.items")
    expect(onFormattingError).toHaveBeenCalledWith("FORMATTING_ERROR")
    expect(JSON.stringify(onFormattingError.mock.calls)).not.toContain("secret")
    expect(onMissing).not.toHaveBeenCalled()
  })

  it("TC-5: suppresses per-key reports when the whole locale is unavailable", () => {
    const { handlers, onMissing } = setup(false)
    const error = intlError("MISSING_MESSAGE") as unknown as IntlErrorArg
    for (let i = 0; i < 100; i++) {
      expect(handlers.getMessageFallback({ namespace: "Common", key: `k${i}`, error })).toBe(`Common.k${i}`)
    }
    expect(onMissing).not.toHaveBeenCalled()
  })
})
