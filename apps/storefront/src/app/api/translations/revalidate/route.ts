import { timingSafeEqual } from "node:crypto"

import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { recordTranslationRefresh, translationCacheTag } from "@/lib/data/ui-translations"
import { readBoundedBody } from "@/lib/util/read-bounded-body"

export const runtime = "nodejs"

const MAX_BODY_BYTES = 2048

function canonicalLocale(value: string): string | null {
  if (value.length > 64 || /[\s/\\]/.test(value)) {
    return null
  }
  try {
    const canonical = Intl.getCanonicalLocales(value)
    return canonical.length === 1 ? canonical[0] : null
  } catch {
    return null
  }
}

const refreshSchema = z
  .object({
    locale: z.string().min(1).max(64),
    version: z.number().int().positive(),
    is_active: z.boolean(),
  })
  .strict()

function authorized(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET ?? ""
  const header = request.headers.get("authorization") ?? ""
  const supplied = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  const expected = Buffer.from(secret)
  const actual = Buffer.from(supplied)
  return Boolean(secret) && actual.length === expected.length && timingSafeEqual(actual, expected)
}

function reply(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

/**
 * Backend-to-storefront callback after a committed translation change. Invalidates exactly one
 * locale's cache tag; there is no generic tag or URL invalidation here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return reply(401, { message: "Unauthorized" })
  }
  const raw = await readBoundedBody(request, MAX_BODY_BYTES)
  if (raw === null) {
    return reply(413, { message: "Payload too large" })
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return reply(400, { message: "Invalid JSON" })
  }
  const parsed = refreshSchema.safeParse(json)
  const locale = parsed.success ? canonicalLocale(parsed.data.locale) : null
  if (!parsed.success || !locale) {
    return reply(400, { message: "Invalid refresh request" })
  }
  if (!recordTranslationRefresh({ ...parsed.data, locale })) {
    // Older than a refresh this process already applied; it must not reinstate older state.
    return reply(200, { revalidated: false, reason: "outdated" })
  }
  revalidateTag(translationCacheTag(locale))
  return reply(200, { revalidated: true })
}
