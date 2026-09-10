# Task 02: MT Output Spot-Check — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-167 (from develop)
**Depends on:** Task 01 (translated catalogs must exist)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest
- **Test location:** `apps/storefront/src/__tests__/lib/i18n/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Per scope.md: **no formal human/linguistic review** — this task checks only for **mechanical MT
failure modes**, not translation quality:
- Untranslated placeholders left as literal English text where translation clearly should have
  occurred (heuristic: a target-locale value identical to the English source, for locales other
  than `en` — flags likely no-op translations, e.g. an API failure that silently returned the
  input unchanged).
- Broken ICU interpolation syntax (`{var}` malformed into `{ var}`, `{va r}`, or dropped
  entirely).
- Broken rich-text tag syntax (e.g. the login heading's `<br>`/`{br}` tag missing or malformed in
  a translated value).

This is an automated check (a Jest test), not a manual linguistic review — consistent with the
story's explicit descoping of human review.

## Code Skeletons

### New File: `apps/storefront/src/__tests__/lib/i18n/mt-output-sanity.test.ts`

```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MESSAGES_DIR = resolve(__dirname, '../../../../messages')
const SOURCE_LOCALE = 'en'
const TARGET_LOCALES = ['da', 'sv', 'no', 'pl', 'it', 'fr', 'de']

type MessageTree = { [key: string]: string | MessageTree }

function flatten(tree: MessageTree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      acc[path] = value
    } else {
      Object.assign(acc, flatten(value, path))
    }
    return acc
  }, {})
}

function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((m) => m[0])
}

describe('MT output sanity', () => {
  const source = flatten(
    JSON.parse(readFileSync(resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`), 'utf-8'))
  )

  it.each(TARGET_LOCALES)('locale "%s" has no obviously-untranslated values', (locale) => {
    const target = flatten(
      JSON.parse(readFileSync(resolve(MESSAGES_DIR, `${locale}.json`), 'utf-8'))
    )
    const suspiciouslyIdentical = Object.entries(target).filter(
      ([key, value]) => source[key] === value && value.length > 3
    )
    expect(suspiciouslyIdentical).toEqual([])
  })

  it.each(TARGET_LOCALES)('locale "%s" preserves all ICU placeholders', (locale) => {
    const target = flatten(
      JSON.parse(readFileSync(resolve(MESSAGES_DIR, `${locale}.json`), 'utf-8'))
    )
    const mismatches = Object.entries(source)
      .map(([key, value]) => ({
        key,
        expected: extractPlaceholders(value).sort(),
        actual: extractPlaceholders(target[key] ?? '').sort(),
      }))
      .filter(({ expected, actual }) => JSON.stringify(expected) !== JSON.stringify(actual))
    expect(mismatches).toEqual([])
  })
})
```

## Impacted Files

- New: `apps/storefront/src/__tests__/lib/i18n/mt-output-sanity.test.ts`.
- No production code changes — this is a verification-only task. If the test finds failures, fix
  the affected keys in the generated `apps/storefront/messages/<locale>.json` files directly (a
  targeted `--force` re-run of Task 01's script for those specific keys, or a manual JSON edit if
  only a handful of keys are affected).

## Test Cases

### TC-1: No suspiciously-untranslated values
- **Given:** a target locale's message catalog
- **When:** compared key-by-key against the English source
- **Then:** no non-trivial (length > 3) value is byte-identical to the English source (a same
  value for short/universal terms like brand names is an accepted false positive — the worker
  should sanity-check any flagged brand-name-only matches manually rather than treating every
  failure as a bug)

### TC-2: ICU placeholders survive translation
- **Given:** a source string containing one or more `{placeholder}` tokens
- **When:** compared against its translated counterpart
- **Then:** the same set of placeholder tokens (by name) appears in the translated string

## Implementation Steps

1. Add the sanity-check test file.
2. Run it against Task 01's generated catalogs.
3. For any failures, either re-run Task 01's script with `--force` for the affected locale (if the
   MT provider had a transient failure) or manually correct the specific broken keys.
4. Re-run the test until green.
5. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- This check catches mechanical failures only, per the story's explicit scope — actual translation
  *quality* (natural phrasing, tone, idiom) is not verified here and, per scope.md, is deferred to
  a future reactive-fix process if issues are reported post-launch.
