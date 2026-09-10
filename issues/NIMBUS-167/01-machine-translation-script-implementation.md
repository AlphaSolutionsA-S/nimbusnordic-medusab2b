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

**Translation provider: DeepL API.** Chosen for this story specifically because all 7 target
locales (Danish, Swedish, Norwegian, Polish, Italian, French, German) are European languages,
where DeepL is generally regarded as the highest-quality MT engine available — a good fit given
this story explicitly skips human review and ships MT output as-is. Uses the official `deepl-node`
SDK and a `DEEPL_API_KEY` environment variable (DeepL's Free tier covers low-volume use cases like
a single message catalog; upgrade to Pro if volume/rate limits become a problem — see Risks).

**DeepL locale code mapping — do not assume 1:1 with this repo's locale codes.** DeepL's target
language codes differ from ours for Norwegian: DeepL expects `NB` (Norwegian Bokmål), not `NO`. All
others match directly: `DA`, `SV`, `PL`, `IT`, `FR`, `DE`. The script must map our `Locale` values
to DeepL's codes before calling the API — see the `DEEPL_TARGET_LANG` map in the skeleton below.

The script is written against a small `Translator` interface so the catalog-walking/placeholder-
protection logic stays decoupled from the DeepL-specific HTTP/SDK details.

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
import * as deepl from 'deepl-node'

const MESSAGES_DIR = resolve(__dirname, '../messages')
const SOURCE_LOCALE = 'en'
const TARGET_LOCALES = ['da', 'sv', 'no', 'pl', 'it', 'fr', 'de'] as const

// DeepL's target-language codes differ from ours for Norwegian (NB, not NO). All others match.
const DEEPL_TARGET_LANG: Record<(typeof TARGET_LOCALES)[number], deepl.TargetLanguageCode> = {
  da: 'da',
  sv: 'sv',
  no: 'nb',
  pl: 'pl',
  it: 'it',
  fr: 'fr',
  de: 'de',
}

type MessageTree = { [key: string]: string | MessageTree }

interface Translator {
  translate(text: string, targetLocale: string): Promise<string>
}

class DeepLTranslator implements Translator {
  private readonly client: deepl.Translator

  constructor(apiKey: string) {
    this.client = new deepl.Translator(apiKey)
  }

  async translate(text: string, targetLocale: string): Promise<string> {
    const targetLang = DEEPL_TARGET_LANG[targetLocale as (typeof TARGET_LOCALES)[number]]
    // DeepL does not know ICU `{var}` syntax natively — wrap placeholders in an <ignore> tag so
    // DeepL's XML tag-handling leaves their contents untouched, then unwrap after translating.
    const protectedText = text.replace(/\{([a-zA-Z0-9_]+)\}/g, '<ignore>{$1}</ignore>')
    const result = await this.client.translateText(protectedText, 'en', targetLang, {
      tagHandling: 'xml',
      ignoreTags: ['ignore'],
    })
    return result.text.replace(/<ignore>(\{[a-zA-Z0-9_]+\})<\/ignore>/g, '$1')
  }
}

const apiKey = process.env.DEEPL_API_KEY
if (!apiKey) {
  throw new Error('DEEPL_API_KEY environment variable is required to run this script.')
}
const translator: Translator = new DeepLTranslator(apiKey)

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

> **Worker note:** never hardcode the DeepL API key in source — it's read from `DEEPL_API_KEY` via
> `process.env`, following this repo's existing `.env.template` convention. DeepL's Free tier has a
> monthly character quota and per-request rate limits — batch translation calls where practical
> (the `deepl-node` SDK's `translateText` accepts an array of strings in one call; consider
> batching all leaf values in a locale's tree into one request instead of one call per key, to stay
> within rate limits — adjust `translateTree` accordingly if the naive per-key-call approach above
> proves too slow/rate-limited in practice).

## Impacted Files

- New: `apps/storefront/scripts/translate-messages.ts`.
- `apps/storefront/package.json`: add `deepl-node` as a dependency, and a script entry, e.g.
  `"translate-messages": "tsx scripts/translate-messages.ts"` (or `ts-node`, matching whichever
  TS execution tool is already a devDependency — check before adding a new one).
- `apps/storefront/messages/{da,sv,no,pl,it,fr,de}.json`: overwritten with translated content when
  the script runs (not hand-written by the worker — generated output).
- `apps/storefront/.env.template`: add `DEEPL_API_KEY` (comment: obtain from
  https://www.deepl.com/pro-api — Free tier is sufficient for this catalog's volume; the user must
  supply the actual key value, this plan cannot provision one).

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

1. Obtain a DeepL API key (Free or Pro tier) and add it to the local `.env`/deployment secrets as
   `DEEPL_API_KEY` — this is a manual credential-provisioning step the worker cannot automate.
2. Add `deepl-node` as a dependency and implement `translate-messages.ts` per the skeleton above.
3. Add the `translate-messages` npm script and the `DEEPL_API_KEY` entry to `.env.template`.
4. Add tests for TC-1–TC-4 using a mocked `Translator` (do not call the real DeepL API in
   automated tests — keep it isolated behind the `Translator` interface for testability).
5. Run the script once against the real DeepL API to generate the 7 locale files, watching for
   rate-limit/quota errors given ~hundreds of keys × 7 locales (batch requests via `deepl-node`'s
   array-input support if the naive per-key-call loop hits limits).
6. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- **DeepL Free tier has a monthly character quota** — hundreds of keys × 7 locales could approach
  it depending on catalog size after NIMBUS-165's full extraction. If the Free tier's quota proves
  insufficient, upgrading to Pro (usage-based billing) is a straightforward config change (same
  SDK, different key) but is a cost decision — flag to the user if the Free tier limit is hit.
- ICU placeholder protection relies on wrapping `{var}` in an `<ignore>` XML tag understood by
  DeepL's `tagHandling: 'xml'` option — verify this round-trips correctly for all placeholder
  patterns actually present in the catalog (not just the simple `{name}` case) before trusting it
  at scale; the sanity check in Task 02 catches regressions here.
- Norwegian requires the `nb` target code (not `no`) — verify this mapping doesn't drift if
  `deepl-node`'s `TargetLanguageCode` type changes across SDK versions.
