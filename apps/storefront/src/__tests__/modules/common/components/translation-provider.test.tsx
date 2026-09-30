import { render, screen } from "@testing-library/react"

type ProviderProps = Record<string, unknown> & { children: React.ReactNode }
const mockProviderProps: ProviderProps[] = []

// Capture what the wrapper hands to next-intl; the real package is not transformable in this Jest setup.
jest.mock("next-intl", () => ({
  NextIntlClientProvider: (props: ProviderProps) => {
    mockProviderProps.push(props)
    return props.children
  },
}))

import TranslationProvider from "@/modules/common/components/translation-provider"

type Fallback = (info: { namespace?: string; key: string; error: { code: string } }) => string

beforeEach(() => {
  mockProviderProps.length = 0
})

describe("TranslationProvider", () => {
  it("passes locale, database messages and client-side error handlers to next-intl", () => {
    render(
      <TranslationProvider locale="da" messages={{ Common: { welcome: "Velkommen" } }} available>
        <p>child</p>
      </TranslationProvider>
    )

    expect(screen.getByText("child")).toBeInTheDocument()
    const props = mockProviderProps[0]
    expect(props.locale).toBe("da")
    expect(props.messages).toEqual({ Common: { welcome: "Velkommen" } })
    expect(typeof props.onError).toBe("function")
    const fallback = props.getMessageFallback as Fallback
    expect(fallback({ namespace: "Common", key: "missing", error: { code: "MISSING_MESSAGE" } })).toBe(
      "Common.missing"
    )
  })

  it("TC-4: renders raw keys instead of crashing for an unavailable locale", () => {
    render(
      <TranslationProvider locale="sv" messages={{}} available={false}>
        <p>still rendered</p>
      </TranslationProvider>
    )

    expect(screen.getByText("still rendered")).toBeInTheDocument()
    const props = mockProviderProps[0]
    expect(() => (props.onError as (error: { code: string }) => void)({ code: "FORMATTING_ERROR" })).not.toThrow()
    expect(
      (props.getMessageFallback as Fallback)({ namespace: "Cart", key: "title", error: { code: "MISSING_MESSAGE" } })
    ).toBe("Cart.title")
  })
})
