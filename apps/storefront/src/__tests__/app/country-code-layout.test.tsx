import type { Context } from "react"

import { render, screen } from "@testing-library/react"

// The real `next-intl` / `next-intl/server` packages pull in a deep ESM
// dependency chain (use-intl, @formatjs/*) that this app's Jest setup isn't
// configured to transform, and `next-intl/server` is server-only besides
// (resolving it in this jsdom environment yields a stub that throws on
// call). Both are mocked with minimal, faithful stand-ins so this test
// exercises the layout's own wiring (params -> locale resolution ->
// setRequestLocale -> runtime database messages -> provider props) rather
// than next-intl's internals. The JSON catalogs are used here only as
// developer fixtures standing in for the backend response.
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

jest.mock("@/lib/data/ui-translations", () => ({
  getRuntimeMessages: jest.fn(async (locale: string) => ({
    locale,
    messages: require(`../../../messages/${locale}.json`),
    availability: "available",
    version: 1,
  })),
}))

jest.mock("next-intl/server", () => {
  const messages = require("../../../messages/en.json") as Messages

  return {
    setRequestLocale: jest.fn(),
    getTranslations: jest.fn(async (namespace: string) => {
      const dict = messages[namespace] ?? {}
      return (key: string) => dict[key] ?? key
    }),
  }
})

import { useLocale, useTranslations } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { getRuntimeMessages } from "@/lib/data/ui-translations"

import CountryLocaleLayout from "@/app/[countryCode]/layout"

function LocaleProbe() {
  const locale = useLocale()
  return <span data-testid="locale-probe">{locale}</span>
}

function ClientWelcome() {
  const t = useTranslations("Common")
  return <p data-testid="client-welcome">{t("welcome")}</p>
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
    expect(setRequestLocale).toHaveBeenCalledWith("da")
    expect(getRuntimeMessages).toHaveBeenCalledWith("da")
  })

  it("provides the se -> sv database messages to client components (TC-1)", async () => {
    const swedish = require("../../../messages/sv.json") as Messages
    const element = await CountryLocaleLayout({
      children: <ClientWelcome />,
      params: Promise.resolve({ countryCode: "se" }),
    })

    render(element)

    expect(getRuntimeMessages).toHaveBeenCalledWith("sv")
    expect(screen.getByTestId("client-welcome")).toHaveTextContent(swedish.Common.welcome)
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
