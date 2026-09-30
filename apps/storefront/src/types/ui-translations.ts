// Mirrors the public/read/report subset of apps/backend/src/types/storefront-translation.ts.
// Kept as a copy: the storefront must not import backend runtime code or its Zod 4 schemas.

export interface MessageDocument {
  [segment: string]: string | MessageDocument
}

export interface LocaleSummary {
  id: string
  locale: string
  version: number
  is_active: boolean
  updated_at: string
}

export interface TranslationDocument extends LocaleSummary {
  messages: MessageDocument
}

export interface RefreshInput {
  locale: string
  version: number
  is_active: boolean
}

export type MissingReport = {
  locale: string
  page_path: string
} & ({ kind: "key"; key: string } | { kind: "locale_unavailable" })

export interface RuntimeMessages {
  locale: string
  messages: MessageDocument
  availability: "available" | "unavailable" | "inactive"
  version: number | null
}
