// Manual Jest mock for `next-intl/server` — see `__mocks__/next-intl.tsx`
// for why this exists and how automatic node_modules mocking applies it.
// `next-intl/server` is additionally server-only, which resolves to a stub
// that throws when imported in this app's jsdom test environment, so a
// faithful stand-in is required for any Server Component test.
import React from "react"

const messages = require("../../messages/en.json") as Record<string, unknown>

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

export async function getTranslations(namespace?: string) {
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
        render
          ? React.createElement(React.Fragment, { key: `rich-${partKey++}` }, render(inner))
          : inner
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

export async function getMessages() {
  return messages
}

export function setRequestLocale() {}

export function getRequestConfig(fn: unknown) {
  return fn
}
