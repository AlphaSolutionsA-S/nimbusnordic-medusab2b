# Task 01: Namespace Convention & Extraction Checklist — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-165 (from develop)
**Depends on:** NIMBUS-163 (message catalogs and translation-consumption pattern must exist)

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

**Scale context:** exploration found **202 `.tsx` files** under `apps/storefront/src/modules`
plus route files under `src/app`. Enumerating a bespoke task for every file up front is not
practical or useful — instead, this task establishes the **namespace convention** and produces a
**tracked checklist** of module areas to extract, which Tasks 02–05 work through using a
repeatable pattern. This keeps the plan honest about scope: full-repo coverage is achieved
iteratively against a visible checklist, not claimed as "done" from a handful of worked examples.

**Namespace convention** (one top-level key per feature area, matching `apps/storefront/src/modules/`
subfolder names in PascalCase):

| Module area | Namespace |
|---|---|
| `modules/layout` (nav, footer) | `Layout` |
| `modules/checkout` | `Checkout` |
| `modules/account` | `Account` |
| `modules/cart` | `Cart` |
| `modules/products` | `Products` |
| `modules/store` / `categories` / `collections` | `Catalog` |
| `modules/common` (shared UI text, e.g. generic buttons) | `Common` |
| Route-level strings in `src/app` not owned by a module | `Common` or a page-specific namespace |

Keys within a namespace are nested by component/section, e.g. `Checkout.contactDetails.emailLabel`.

## Code Skeletons

### New File: `issues/NIMBUS-165/extraction-checklist.md`

```markdown
# NIMBUS-165 String Extraction Checklist

Tracks which module areas have had hardcoded UI strings extracted into translation keys.
Check off each area as its task completes. Do not mark an area done until a full pass of that
folder confirms no remaining hardcoded user-facing strings.

- [ ] `modules/layout` (nav, footer, mega-menu) — Task 02
- [ ] `modules/checkout` (address forms, contact details, payment, review) — Task 03
- [ ] `modules/account` (login, register, dashboard, addresses, orders) — Task 04
- [ ] `modules/cart`
- [ ] `modules/products`
- [ ] `modules/store`, `modules/categories`, `modules/collections`
- [ ] `modules/common` (shared buttons, empty states, error messages)
- [ ] `modules/home` / other top-level marketing modules, if present
- [ ] `src/app/**/page.tsx`, `src/app/**/layout.tsx` route-level static text (excluding
      `generateMetadata` — that's NIMBUS-168's scope)
- [ ] `src/app/[countryCode]/not-found.tsx` and other error/boundary pages

Remaining areas beyond the above are extracted in Task 05 as they're found — update this list as
new module folders are discovered.
```

## Impacted Files

- New: `issues/NIMBUS-165/extraction-checklist.md`.
- No source code changes in this task — it's the convention/tracking groundwork for Tasks 02–05.

## Test Cases

This task produces no runtime behavior, so no automated test applies. Verification is manual:

### TC-1: Checklist matches actual module structure
- **Given:** `apps/storefront/src/modules/` on disk
- **When:** compared against the checklist's list of areas
- **Then:** every top-level folder under `modules/` has a corresponding checklist line (add any
  missing ones found during implementation)

## Implementation Steps

1. Run `ls apps/storefront/src/modules` to get the authoritative current folder list.
2. Write `extraction-checklist.md` with one line per folder found (the table above is a starting
   point based on exploration at planning time — reconcile against the live folder list).
3. No code changes; this task is a planning artifact that Tasks 02–05 update as they land.
