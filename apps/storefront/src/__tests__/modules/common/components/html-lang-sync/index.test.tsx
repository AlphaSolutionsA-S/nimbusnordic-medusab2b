import { render } from "@testing-library/react"

jest.mock("next-intl", () => ({
  useLocale: jest.fn(),
}))

import { useLocale } from "next-intl"

import HtmlLangSync from "@/modules/common/components/html-lang-sync"

describe("HtmlLangSync", () => {
  it("sets the document's lang attribute to the active locale (TC-1)", () => {
    ;(useLocale as jest.Mock).mockReturnValue("de")

    render(<HtmlLangSync />)

    expect(document.documentElement.lang).toBe("de")
  })

  it("updates the lang attribute when the locale changes (TC-2)", () => {
    ;(useLocale as jest.Mock).mockReturnValue("fr")
    const { rerender } = render(<HtmlLangSync />)
    expect(document.documentElement.lang).toBe("fr")

    ;(useLocale as jest.Mock).mockReturnValue("pl")
    rerender(<HtmlLangSync />)

    expect(document.documentElement.lang).toBe("pl")
  })
})
