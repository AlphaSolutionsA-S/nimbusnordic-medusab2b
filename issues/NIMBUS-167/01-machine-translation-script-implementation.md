# Task 01: Machine Translation Script for Message Catalogs — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-167 (from develop)
**Depends on:** NIMBUS-165 (all English keys must be extracted into `apps/storefront/messages/en.json`
before translation runs)

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

Write a one-off Node script (not part of the Next.js runtime — a build-time/dev-time tool) that
reads `apps/storefront/messages/en.json` and produces translated output for the 7 remaining
locales (da, sv, no, pl, it, fr, de), preserving the exact key structure and any ICU interpolation
placeholders / rich-text tags (e.g. the `{br}` tag from NIMBUS-165's login heading) unchanged.

**Translation provider choice:** this plan does not select a specific paid MT API (e.g. DeepL,
Google Cloud Translate, Azure Translator) — that requires an API key/vendor decision which is a
business/procurement choice, not a technical one this plan can make unilaterally. Flagging this as
an **open question for the user** before implementation starts (see Risks). The script is written
against a small `Translator` interface so swapping providers later doesn't require touching the
catalog-walking logic.

The script must:
1. Recursively walk `en.json`'s keys.
2. For each string leaf value, detect and protect ICU placeholders (`{variable}`) and rich-text
   tags (`<tag>...</tag>`) from being mangled by translation — most MT APIs support this via
   "do not translate" markup or a placeholder-substitution pass before/after calling the API.
3. Write the translated result to `apps/storefront/messages/<locale>.json`, preserving key order
   and structure exactly.
4. Be idempotent/re-runnable (e.g. skip keys that already have non-placeholder translated content,
   controlled via a `--force` flag to re-translate everything).

## Code Skeletons

### New File: `apps/storefront/scripts/translate-messages.ts`

```typescript
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MESSAGES_DIR = resolve(__dirname, '../messages')
const SOURCE_LOCALE = 'en'
const TARGET_LOCALES = ['da', 'sv', 'no', 'pl', 'it', 'fr', 'de'] as const

type MessageTree = { [key: string]: string | MessageTree }

interface Translator {
  translate(text: string, targetLocale: string): Promise<string>
}

// IMPLEMENT: wire up the chosen MT provider's SDK/HTTP client here.
// Must preserve ICU placeholders ({var}) and rich-text tags (<tag>...</tag>) verbatim.
declare const translator: Translator

async function translateTree(
  tree: MessageTree,
  targetLocale: string,
  existing: MessageTree | undefined,
  force: boolean
): Promise<MessageTree> {
  const result: MessageTree = {}

  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      const existingValue = existing?.[key]
      if (!force && typeof existingValue === 'string' && existingValue !== value) {
        result[key] = existingValue
        continue
      }
      result[key] = await translator.translate(value, targetLocale)
    } else {
      result[key] = await translateTree(
        value,
        targetLocale,
        typeof existing?.[key] === 'object' ? (existing[key] as MessageTree) : undefined,
        force
      )
    }
  }

  return result
}

async function main() {
  const force = process.argv.includes('--force')
  const source: MessageTree = JSON.parse(
    readFileSync(resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`), 'utf-8')
  )

  for (const locale of TARGET_LOCALES) {
    const targetPath = resolve(MESSAGES_DIR, `${locale}.json`)
    let existing: MessageTree | undefined
    try {
      existing = JSON.parse(readFileSync(targetPath, 'utf-8'))
    } catch {
      existing = undefined
    }

    const translated = await translateTree(source, locale, existing, force)
    writeFileSync(targetPath, JSON.stringify(translated, null, 2) + '\n')
    console.log(`Translated ${locale}.json`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

> **Worker note:** the `Translator` interface and its `declare const translator` are a deliberate
> placeholder — the actual MT provider integration (API key handling via env var, HTTP client or
> SDK, rate limiting/batching for ~hundreds of keys × 7 locales) must be filled in based on the
> provider the user/team selects (see Risks). Do not hardcode an API key in source; read it from
> an env var following this repo's existing `.env.template` convention.

## Impacted Files

- New: `apps/storefront/scripts/translate-messages.ts`.
- `apps/storefront/package.json`: add a script entry, e.g.
  `"translate-messages": "tsx scripts/translate-messages.ts"` (or `ts-node`, matching whichever
  TS execution tool is already a devDependency — check before adding a new one).
- `apps/storefront/messages/{da,sv,no,pl,it,fr,de}.json`: overwritten with translated content when
  the script runs (not hand-written by the worker — generated output).
- `apps/storefront/.env.template`: add the MT provider's API key env var (name depends on provider
  chosen).

## Test Cases

### TC-1: Placeholder preservation
- **Given:** a source string `"Hello {name}"`
- **When:** run through the translation pass (test with a mocked `Translator` that reverses the
  string, to verify placeholder protection independent of any real MT quality)
- **Then:** the output still contains a literal `{name}` placeholder, not a mangled/translated
  version of it

### TC-2: Idempotent re-run skips already-translated keys
- **Given:** a target locale file that already has a translated (non-English) value for a key
- **When:** the script runs without `--force`
- **Then:** that key's value is left unchanged (translator is not called again for it)

### TC-3: `--force` re-translates everything
- **Given:** the same setup as TC-2
- **When:** the script runs with `--force`
- **Then:** the translator is called for every key, including ones with existing translations

### TC-4: Output key structure matches source exactly
- **Given:** `en.json`'s full key structure
- **When:** any target locale file is generated
- **Then:** its key paths are identical to `en.json`'s (only leaf string values differ) — reuses
  the key-structure-parity check pattern from NIMBUS-165 Task 05's TC-2

## Implementation Steps

1. **Before writing provider-specific code:** confirm the MT provider/API with the user (see
   Risks — this is an open question this plan cannot resolve unilaterally).
2. Implement `translate-messages.ts` with the chosen provider wired into the `Translator`
   interface.
3. Add the `translate-messages` npm script and the API key env var to `.env.template`.
4. Add tests for TC-1–TC-4 using a mocked `Translator` (do not call a real paid API in automated
   tests).
5. Run the script once against a real (or sandboxed/free-tier) MT provider to generate the 7
   locale files.
6. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- **Open question, blocking:** which MT provider/API to use (DeepL, Google Cloud Translate, Azure
  Translator, etc.) has not been decided — scope.md and the epic scope don't specify one. This is
  a vendor/cost decision, not a purely technical one. Recommend surfacing this to the user before
  implementation starts; the code skeleton above is provider-agnostic specifically so this
  decision doesn't block writing the surrounding script logic.
- Running MT against hundreds of keys × 7 locales may hit provider rate limits or per-character
  costs — batch requests where the chosen provider's API supports it, and confirm cost expectations
  with the user before running against a paid tier at full scale.
