# Task 01: Contracts and document helpers

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 01
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** None

## Environment and references

Read `PLAN.md`, `CONTRACTS.md`, secure-coding-owasp and building-with-medusa.
Backend uses TypeScript, Jest/SWC, Zod 4.2.0. Tests belong in
`src/utils/translations/__tests__/*.unit.spec.ts`. Run the backend unit script
against these source paths and `pnpm build`; exclude compiled `.medusa/server`
duplicates. No database or migration is needed for this task.

## New files and skeletons

`src/types/storefront-translation.ts`: use all declarations in CONTRACTS.md verbatim.

`src/utils/translations/documents.ts`:

```ts
import type { DocumentDiff, MessageDocument } from '../../types/storefront-translation';

export function flattenMessages(document: MessageDocument): Record<string, string> {
  // IMPLEMENT: own-key traversal of an already validated document.
}
export function unflattenMessages(values: Readonly<Record<string, string>>): MessageDocument {
  // IMPLEMENT: safe own-property creation, rejecting leaf/object collisions.
}
export function updateMessageLeaves(
  document: MessageDocument,
  values: Readonly<Record<string, string>>,
): MessageDocument {
  // IMPLEMENT: require the exact existing leaf-key set and immutably replace values.
  // Preserve empty nested objects and every group in the original document.
}
export function diffMessages(current: MessageDocument, candidate: MessageDocument): DocumentDiff {
  // IMPLEMENT: deterministic sorted key lists; changed means unequal string values.
}
export function mergeMessages(current: MessageDocument, incoming: MessageDocument): MessageDocument {
  // IMPLEMENT: immutable deep merge, supplied leaves overwrite, absent keys survive.
}
export function labelForKey(key: string): { section: string; group: string; label: string } {
  // IMPLEMENT: split path, humanize camelCase/underscore/dash, preserve key identity.
}
export function compareMissing(current: MessageDocument, reference: MessageDocument): string[] {
  // IMPLEMENT: missing or whitespace-only values relative to reference leaves.
}
```

`src/utils/translations/validation.ts`:

```ts
import { z } from 'zod';
import type { MessageDocument } from '../../types/storefront-translation';

export const localeSchema = z.string().max(64).transform((value, ctx) => {
  // IMPLEMENT: canonicalize or add a Zod issue and return z.NEVER.
});
export const messageDocumentSchema: z.ZodType<MessageDocument> =
  // IMPLEMENT: bounded recursive object schema and own-key security checks.
  // Do not coerce arrays, numbers, null, or malformed objects into strings.
  undefined as never;
```

The skeleton placeholder above must be replaced, not shipped. Keep size/depth/key
caps from CONTRACTS.md in named constants here. Use UTF-8 byte length, not JS
string length, for the document cap. Render validation errors without including
the full imported document. This file is backend-only; Admin uses server previews
and only the pure document/ICU helpers below.

`src/utils/translations/icu.ts`:

```ts
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';
import type { IcuWarning, MessageDocument } from '../../types/storefront-translation';

export function compareIcu(
  messages: MessageDocument,
  reference: MessageDocument | null,
): IcuWarning[] {
  // IMPLEMENT: parse ICU ASTs including nested plural/select/tag children.
  // Compare argument names/kinds and required select/rich-text structure.
  // Catch parse errors as warnings, not document validation errors.
}
```

Add `@formatjs/icu-messageformat-parser` as an explicit backend dependency. Version
2.11.4 is already present in the local tree and is the starting compatible choice;
verify its browser/Admin build before locking it. Do not consume an undeclared
hoisted dependency. ICU warnings must not prevent save, including malformed ICU.
Different valid language plural categories alone are not a blocking error.

## Implementation order

1. Create types, limits, and validation.
2. Implement immutable document helpers. Never use an unsafe generic deep merge.
3. Add the parser dependency and ICU comparison.
4. Write the tests below and run the unit suite/build. Export named pure functions;
   avoid a barrel or importing a module service into browser-used helpers.

## Test cases and scaffolding

Create `documents.unit.spec.ts`, `validation.unit.spec.ts`, and `icu.unit.spec.ts`
under the test directory above. Each uses `describe`, `it`, and direct named
imports from `../documents`, `../validation`, or `../icu`.

- **TC-1:** Given nested keys and Unicode values, when flattening/unflattening and
  JSON exporting/importing, then string leaves and empty strings are preserved;
  inputs remain unchanged. Also update a leaf in a document containing an empty
  nested object and assert that group survives. `flattenMessages`/`unflattenMessages`
  round-trip string leaves only and are not a whole-document round-trip mechanism.
- **TC-2:** Given a current and incoming document, when merging/replacing, then
  added/changed/removed/empty lists are correct; merging preserves omitted keys.
  A string/object collision rejects merge with its key path.
- **TC-3:** Given JSON.parse input containing `__proto__`, dotted segments, arrays,
  or excessive size/depth, when validating, then reject without prototype changes.
  Test multibyte strings near the byte limit.
- **TC-4:** Given equivalent ICU arguments, when comparing locales with different
  legitimate plural categories, then do not classify the translation as invalid.
  Missing arguments/tags and malformed ICU produce warnings while valid JSON
  remains saveable. Missing English produces a reference-unavailable warning.
- **TC-5:** Given `Common.notFound.headingLabel`, when deriving labels, then use
  section Common, group Not found, label Heading label. Search identity stays the
  original path; same labels on different paths never overwrite each other.

Consumers: Task 02 uses types/validation/helpers; Task 03 defines schemas around
them; Tasks 04-05 import only pure browser-safe helpers and type-only contracts.
