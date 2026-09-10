// Manual Jest mock for `next-intl`, applied automatically to every test in
// this app (Jest auto-applies a `__mocks__` file adjacent to `node_modules`
// for node_modules packages, with no per-test `jest.mock()` call needed).
// The real package pulls in a deep ESM dependency chain (use-intl,
// @formatjs/*) that this app's Jest transform isn't configured for, so tests
// use this minimal, faithful stand-in instead. It resolves keys against the
// real `en` message catalog so component tests exercise actual copy.
//
// A test that needs a different locale/catalog, or needs to assert
// missing-key behavior, can still call `jest.mock('next-intl', () => ...)`
// itself — an explicit mock in a test file always takes precedence over this
// automatic one.
import React from "react"

const messages = require("../messages/en.json") as Record<string, unknown>

// Resolves a dot-delimited path (a namespace, or a nested key within one)
// against a root object — mirrors next-intl's own support for nested key
// paths within a namespace (e.g. `t("categoryTemplate.backToAllProductsLabel")`).
function resolvePath(root: unknown, path?: string): unknown {
  if (!path) {
    return root
  }
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      root
    )
}

function formatValue(template: string, values?: Record<string, unknown>): string {
  if (!values) {
    return template
  }
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template
  )
}

type RichValues = Record<string, (chunks: React.ReactNode) => React.ReactNode>

function createTranslator(namespace?: string) {
  const dict = (resolvePath(messages, namespace) as Record<string, unknown>) ?? {}

  const t = (key: string, values?: Record<string, unknown>) => {
    const template = resolvePath(dict, key)
    return typeof template === "string" ? formatValue(template, values) : key
  }

  t.rich = (key: string, values: RichValues) => {
    const template = resolvePath(dict, key)
    if (typeof template !== "string") {
      return key
    }

    const parts: React.ReactNode[] = []
    const tagPattern = /<(\w+)>(.*?)<\/\1>/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    let partKey = 0

    while ((match = tagPattern.exec(template)) !== null) {
      if (match.index > lastIndex) {
        parts.push(template.slice(lastIndex, match.index))
      }
      const [, tag, inner] = match
      const render = values[tag]
      parts.push(
        render ? (
          <React.Fragment key={`rich-${partKey++}`}>{render(inner)}</React.Fragment>
        ) : (
          inner
        )
      )
      lastIndex = tagPattern.lastIndex
    }
    if (lastIndex < template.length) {
      parts.push(template.slice(lastIndex))
    }

    return parts.length > 0 ? parts : template
  }

  return t
}

export function useTranslations(namespace?: string) {
  return createTranslator(namespace)
}

export function useLocale() {
  return "en"
}

export function NextIntlClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
