import type { Context } from "react"

import { render, screen } from "@testing-library/react"

// The real `next-intl` / `next-intl/server` packages pull in a deep ESM
// dependency chain (use-intl, @formatjs/*) that this app's Jest setup isn't
// configured to transform, and `next-intl/server` is server-only besides
// (resolving it in this jsdom environment yields a stub that throws on
// call). Both are mocked with minimal, faithful stand-ins so this test
// exercises the layout's own wiring (params -> published country language ->
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
    // No developer catalog exists for a language added in Admin.
    messages: locale === "nl" ? { Common: { welcome: "Welkom" } } : require(`../../../messages/${locale}.json`),
    availability: "available",
    version: 1,
  })),
}))

jest.mock("next-intl/server", () => {
  const messages = require("../../../messages/en.json") as Messages

  return {
    getRequestConfig: (fn: unknown) => fn,
    setRequestLocale: jest.fn(),
    getTranslations: jest.fn(async (namespace: string) => {
      const dict = messages[namespace] ?? {}
      return (key: string) => dict[key] ?? key
    }),
  }
})

// The real country-language loader runs against this publication; only the transport is mocked.
// jsdom lacks AbortSignal.timeout, whose signal the loader only hands to that mocked transport.
if (typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = () => new AbortController().signal
}
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({
  sdk: {
    client: {
      fetch: jest.fn(async () => ({
        default_locale: "en",
        countries: [
          { country_code: "dk", locale: "da", source: "explicit" },
          { country_code: "gb", locale: "en", source: "default" },
          { country_code: "nl", locale: "nl", source: "explicit" },
          { country_code: "se", locale: "sv", source: "explicit" },
        ],
      })),
    },
  },
}))
jest.mock("@/lib/i18n/missing-key-server", () => ({
  reportMissingTranslation: jest.fn(),
  reportTranslationFormattingError: jest.fn(),
}))
jest.mock("next/headers", () => ({ headers: jest.fn() }))

import { useLocale, useTranslations } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { headers } from "next/headers"

import { getRuntimeMessages } from "@/lib/data/ui-translations"
import getRequestConfigForRequest from "@/i18n/request"

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

  it("gives the server request config and the client provider the same ninth-language verdict", async () => {
    jest.mocked(headers).mockResolvedValue(
      new Headers({ "x-storefront-country": "nl", "x-storefront-pathname": "/nl" }) as never
    )
    const config = await getRequestConfigForRequest({ requestLocale: Promise.resolve("de") })
    const element = await CountryLocaleLayout({
      children: (
        <>
          <LocaleProbe />
          <ClientWelcome />
        </>
      ),
      params: Promise.resolve({ countryCode: "nl" }),
    })

    render(element)

    expect(config.locale).toBe("nl")
    expect(screen.getByTestId("locale-probe")).toHaveTextContent("nl")
    expect(screen.getByTestId("client-welcome")).toHaveTextContent("Welkom")
    expect(config.messages).toEqual({ Common: { welcome: "Welkom" } })
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
