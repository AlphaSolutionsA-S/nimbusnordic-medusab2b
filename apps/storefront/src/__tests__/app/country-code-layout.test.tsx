import type { Context } from "react"

import { render, screen } from "@testing-library/react"

// The real `next-intl` / `next-intl/server` packages pull in a deep ESM
// dependency chain (use-intl, @formatjs/*) that this app's Jest setup isn't
// configured to transform, and `next-intl/server` is server-only besides
// (resolving it in this jsdom environment yields a stub that throws on
// call). Both are mocked with minimal, faithful stand-ins so this test
// exercises the layout's own wiring (params -> locale resolution ->
// setRequestLocale -> getMessages -> provider props) rather than next-intl's
// internals.
type Messages = Record<string, Record<string, string>>
type LocaleContextValue = { locale: string; messages: Messages } | null

jest.mock("next-intl", () => {
  const React = require("react")
  const Ctx: Context<LocaleContextValue> = React.createContext(null)

  return {
    NextIntlClientProvider: ({
      locale,
      messages,
      children,
    }: {
      locale: string
      messages: Messages
      children: React.ReactNode
    }) => React.createElement(Ctx.Provider, { value: { locale, messages } }, children),
    useLocale: () => React.useContext(Ctx)?.locale,
    useTranslations: (namespace: string) => {
      const ctx = React.useContext(Ctx)
      const dict = ctx?.messages?.[namespace] ?? {}
      return (key: string) => dict[key] ?? key
    },
  }
})

jest.mock("next-intl/server", () => {
  const messages = require("../../../messages/en.json") as Messages

  return {
    getMessages: jest.fn(async () => messages),
    setRequestLocale: jest.fn(),
    getTranslations: jest.fn(async (namespace: string) => {
      const dict = messages[namespace] ?? {}
      return (key: string) => dict[key] ?? key
    }),
  }
})

import { useLocale, useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"

import CountryLocaleLayout from "@/app/[countryCode]/layout"

function LocaleProbe() {
  const locale = useLocale()
  return <span data-testid="locale-probe">{locale}</span>
}

function ClientExample() {
  const t = useTranslations("Common")
  return <p>{t("welcome")}</p>
}

async function ServerExample() {
  const t = await getTranslations("Common")
  return <p>{t("welcome")}</p>
}

describe("CountryLocaleLayout", () => {
  it("resolves the locale for a known country and exposes it via context (TC-1)", async () => {
    const element = await CountryLocaleLayout({
      children: <LocaleProbe />,
      params: Promise.resolve({ countryCode: "dk" }),
    })

    render(element)

    expect(screen.getByTestId("locale-probe")).toHaveTextContent("da")
  })

  it("falls back to the default locale for an unmapped country (TC-2)", async () => {
    const element = await CountryLocaleLayout({
      children: <LocaleProbe />,
      params: Promise.resolve({ countryCode: "us" }),
    })

    render(element)

    expect(screen.getByTestId("locale-probe")).toHaveTextContent("en")
  })

  it("renders translated text end-to-end via the client consumption pattern (TC-3)", async () => {
    const element = await CountryLocaleLayout({
      children: <ClientExample />,
      params: Promise.resolve({ countryCode: "gb" }),
    })

    render(element)

    expect(screen.getByText("Welcome")).toBeInTheDocument()
  })

  it("renders translated text end-to-end via the server consumption pattern (TC-3)", async () => {
    const element = await CountryLocaleLayout({
      children: await ServerExample(),
      params: Promise.resolve({ countryCode: "gb" }),
    })

    render(element)

    expect(screen.getByText("Welcome")).toBeInTheDocument()
  })
})
