# Task 05: Remaining Modules Sweep & Regression Check — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 05
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-165 (from develop)
**Depends on:** Task 01 (namespace convention/checklist), Task 02, Task 03, Task 04 (establish the
pattern this task repeats)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/`
- **Naming conventions:** per `apps/storefront/copilot-instructions.md`

## Solution Design

Tasks 02–04 covered layout, checkout (contact/address forms), and account (login/register) as
worked examples of the extraction pattern. This task applies the **same pattern** — read the
component, identify hardcoded user-facing strings, add keys under the appropriate namespace (per
Task 01's table), replace with `t()`/`t.rich()` calls, add the same key to all 8 catalogs — to
every remaining unchecked area in `extraction-checklist.md`:

- `modules/cart`
- `modules/products`
- `modules/store`, `modules/categories`, `modules/collections`
- `modules/common` (shared buttons, empty states, error messages)
- `modules/account` remainder (dashboard, addresses, orders — beyond login/register)
- `modules/checkout` remainder (payment step, order review — beyond contact/address forms)
- `modules/home` / other top-level marketing modules, if present
- `src/app/**/page.tsx`, `src/app/**/layout.tsx` route-level static text (excluding
  `generateMetadata`, which is NIMBUS-168's scope)
- `src/app/[countryCode]/not-found.tsx` and other error/boundary pages

**This is intentionally not pre-enumerated string-by-string** — the volume (remaining ~190 of the
202 `.tsx` files under `modules/`, minus the ones covered in Tasks 02–04) makes that impractical in
a plan document; the worker follows the established pattern module-by-module, checking off
`extraction-checklist.md` as each area completes. Do not skip areas silently — if an area is found
to have no hardcoded strings (e.g. a purely presentational wrapper), check it off with a note
rather than leaving it unchecked or silently ignoring it.

**Explicitly out of scope** (do not extract):
- Data-sourced strings (product names/descriptions from Medusa, category names, order data) —
  excluded per NIMBUS-159 epic scope (product/catalog content is a separate future phase).
- `generateMetadata` title/description strings — NIMBUS-168's scope.
- Developer-facing content (console logs, code comments, test fixtures).

## Code Skeletons

No single skeleton applies across ~190 files. The worker repeats this per-file pattern (identical
to Tasks 02–04's worked examples):

```tsx
// 1. Determine if the file is a Server or Client Component (presence of 'use client').
// 2a. Server Component:
import { getTranslations } from 'next-intl/server'
export async function SomeComponent() {
  const t = await getTranslations('<Namespace>.<section>')
  // replace hardcoded strings with t('key')
}

// 2b. Client Component:
'use client'
import { useTranslations } from 'next-intl'
export function SomeComponent() {
  const t = useTranslations('<Namespace>.<section>')
  // replace hardcoded strings with t('key')
}

// 3. Add the same key, with the original English text as the value, to ALL 8 files in
//    apps/storefront/messages/*.json (non-English translation is NIMBUS-167's scope — every
//    catalog gets identical English content at this stage, per the pattern in Tasks 02–04).
```

## Impacted Files

- All remaining `.tsx` files under `apps/storefront/src/modules/` and `apps/storefront/src/app/`
  containing hardcoded user-facing UI strings, per the checklist areas above. Exact file list is
  determined during implementation via a repo-wide grep for common patterns (e.g. JSX text nodes,
  `placeholder=`, `label=`, `title=`, `aria-label=` string literals) — not enumerated here given
  volume.
- `apps/storefront/messages/{da,en,sv,no,pl,it,fr,de}.json`: grows with each area's new namespace
  keys.
- `issues/NIMBUS-165/extraction-checklist.md`: checked off as each area completes.

## Test Cases

Each sub-area extracted under this task follows the same test pattern as Tasks 02–04:

### TC-1: Per-area regression check
- **Given:** the `en` locale is active
- **When:** any extracted component renders
- **Then:** rendered text matches pre-extraction content exactly (add a targeted RTL test per
  component, or extend existing component tests if present, following the existing test file
  naming convention: `<ComponentName>.test.tsx`)

### TC-2: Full-catalog structural consistency
- **Given:** all 8 message catalog files after this task completes
- **When:** their key structures are compared (e.g. via a small script or manual diff of key
  paths, ignoring values)
- **Then:** all 8 files have identical key structure (only values may differ once NIMBUS-167
  translates them) — add a test similar to NIMBUS-163 Task 02's `message-catalogs.test.ts` that
  recursively asserts key-path parity across all 8 files

### TC-3: No remaining hardcoded strings in a swept area (spot-check)
- **Given:** an area marked complete in `extraction-checklist.md`
- **When:** grepped for common hardcoded-string patterns (JSX text, `label=`, `placeholder=`)
- **Then:** no user-facing hardcoded strings remain outside of data-sourced/out-of-scope content

## Implementation Steps

1. Work through `extraction-checklist.md` area by area, applying the pattern above.
2. For each area: read the relevant files, extract strings, add keys to all 8 catalogs, add/update
   a regression test, check off the area.
3. After all areas are checked off, add the full-catalog key-structure-parity test (TC-2).
4. Run a final repo-wide manual/grep spot-check for obviously-missed hardcoded strings.
5. Manually verify the full storefront (home, PLP, PDP, cart, checkout, account) renders
   identically to pre-extraction in the `en` locale — this is the story's core non-functional
   requirement ("no visual/behavioral regression").
6. Run `pnpm lint`, `pnpm test`, `pnpm build`.

## Risks

- **Scale risk:** ~190 files is a large surface area for a single task. If the worker's context
  window or session length can't complete the full sweep in one pass, split by the checklist's
  area boundaries into separate work sessions — the checklist file is the resumption point, so
  partial progress is never lost or ambiguous.
- Some components may mix data-sourced and hardcoded strings (e.g. an empty-state message with a
  hardcoded sentence next to a dynamic product name) — extract only the hardcoded portion; do not
  wrap dynamic/data-sourced content in translation keys.
