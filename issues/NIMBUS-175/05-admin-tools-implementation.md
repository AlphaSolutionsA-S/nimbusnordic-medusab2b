# Task 05: Import, languages, comparison, and missing-key tools

**Status:** DONE
**App:** backend Admin
**App Root:** apps/backend
**Task ID:** 05
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 04

## Environment

Reload the Admin skill and forms/data-loading/display-patterns references.
Use the Task 04 jsdom harness and the same SDK/query keys. Type imports below
come from `src/types/storefront-translation.ts`; endpoints and DTOs are fixed
in CONTRACTS.md. All changes are inside Admin hooks and the translations route.

## Components and exact interfaces

Create these files under `src/admin/routes/translations/components/`. Each uses
named exports, React controlled state, Medusa UI (`FocusModal`, `Button`, `Input`,
`Select`, `Checkbox`, `Text`, `Table` as appropriate), and hooks added to
`src/admin/hooks/api/ui-translations.tsx`. No direct browser fetch to the backend.

Create `src/admin/lib/translations.ts` with the readonly
`INITIAL_IMPORT_LOCALES = ['da', 'de', 'en', 'fr', 'it', 'no', 'pl', 'sv'] as const`
tuple. Create `components/ImportReadiness.tsx` with props
`{ locales: readonly LocaleSummary[]; isLoading: boolean;
onImport: (locale: string) => void }`. Render all eight statuses while loading;
once loaded, mark each as missing, imported/inactive, or imported/active. Keep the
panel in the editor page and use the existing import modal with its locale
preselected.

```tsx
// TranslationImportModal.tsx
import type { TranslationDocument } from '../../../../types/storefront-translation';
export interface ImportModalProps {
  open: boolean;
  locale: string;
  current: TranslationDocument | null;
  onClose: () => void;
  onApplied: (document: TranslationDocument) => void;
}
export function TranslationImportModal(props: ImportModalProps) {
  // IMPLEMENT: upload -> mode -> server preview -> explicit apply/close.
}

// CreateLanguageModal.tsx
import type { LocaleSummary, TranslationDocument } from '../../../../types/storefront-translation';
export interface CreateLanguageModalProps {
  open: boolean;
  locales: LocaleSummary[];
  onClose: () => void;
  onCreated: (document: TranslationDocument) => void;
}
export function CreateLanguageModal(props: CreateLanguageModalProps) {
  // IMPLEMENT: canonical locale + copy source/version or file-import preview.
}

// MissingKeysTable.tsx
import type { TranslationDocument } from '../../../../types/storefront-translation';
export interface MissingKeysTableProps {
  locale?: string;
  document: TranslationDocument | null;
  onResolved: (document: TranslationDocument) => void;
}
export function MissingKeysTable(props: MissingKeysTableProps) {
  // IMPLEMENT: paginated list, resolve field, dismiss, and outage notices.
}

// LanguageComparison.tsx
import type { MessageDocument } from '../../../../types/storefront-translation';
export interface LanguageComparisonProps {
  current: MessageDocument;
  reference: MessageDocument | null;
}
export function LanguageComparison(props: LanguageComparisonProps) {
  // IMPLEMENT: missing/empty keys from compareMissing; no mutation.
}
```

Follow the same file-local imports for UI and hook dependencies; no exported
component requires application-specific props other than the interfaces above.

Extend the hook file with `usePreviewImport(locale)`, `useImportTranslation(locale)`,
`useCreateTranslation()`, `useActivateTranslation(locale)`,
`useMissingTranslations(locale, offset)`, `useResolveMissing(locale)`, and
`useDismissMissing(locale)`. Bodies and results match CONTRACTS.md. Mutations
invalidate the shared prefix, including paginated missing queries; preview does
not invalidate or persist anything. Include pagination offset in missing query keys.

Export can use the SDK detail response's exact `messages` data to create an
application/json Blob, named `<canonical-locale>.json`, avoiding bypass of session
auth with a naked download URL. Serialize with two spaces/newline, revoke the
object URL, and explain that this exports saved data. The backend export endpoint
is also available and must obey the same document-only contract.

## Behavior and wiring

1. Add an import-readiness panel for the original locale set
   `da,de,en,fr,it,no,pl,sv`. Define that tuple in an Admin-only
   `src/admin/lib/translations.ts` constant named `INITIAL_IMPORT_LOCALES`; show
   each locale as missing, imported/inactive, or imported/active based on DB rows.
   Missing entries offer the existing import flow preselected for that locale.
   This is a one-time readiness checklist, not a restriction on the DB-driven
   language selector or on adding other locales, and it does not change country
   mapping.
2. Add editor toolbar buttons for compare language/file, import, export, add
   language, and activation. The locale selector comes from DB rows, not a fixed
   list of eight. Display inactive state visibly.
3. Compare-with-file opens the same preview modal; closing it performs no write.
   Server preview captures current locale/version and selected mode. Changing
   file, mode, or target invalidates that preview and resets removal confirmation.
4. Highlight removed keys for replace and require an unchecked-by-default
   confirmation. Include old/new strings in a bounded/scrollable preview, rendered
   as text. Apply recomputes on the server; a stale preview409 retains the uploaded
   file/draft and offers a fresh preview, never an automatic overwrite.
5. New language copy requires a chosen existing source plus its version; file
   import works with zero existing locales. Both create inactive rows. Activation
   uses the same version/conflict behavior as editing. Saving incomplete or
   ICU-warning-bearing text remains allowed per scope.
6. Missing-key resolution can add exactly the reported key with the loaded document
   version. Show normal conflicts. Outage entries instead offer import/activation
   guidance, never a fake key editor. Dismissed entries stay hidden until resolution
   clears the marker; repeated reports do not reopen them. Include an all-languages
   view for locale-outage reports before a locale row exists.
7. Protect unsaved editor state before import/activation/resolution swaps its
   document. Never silently discard dirty work after another tool succeeds.

## Tests

Add `tools.test.tsx` beside Task 04's editor test; mock SDK only and use a real
QueryClientProvider. Test input via `userEvent.upload` and labelled controls.

- **TC-1:** Given no locales, when importing a valid first file, then show preview,
  create inactive, select it, and allow explicit activation. No English-row dependency.
- **TC-2:** Given removals, when selecting replace, then Apply remains disabled
  until confirmation; changing file/mode clears confirmation. Close makes no write.
- **TC-3:** Given a concurrent change, when applying the preview, then display409
  and retain input; success invalidates correct queries and adopts new version.
- **TC-4:** Given another reference language, when comparing, then list its missing
  and empty keys only. Export round-trips nested Unicode/ICU/empty-string content.
- **TC-5:** Given a missing key, when filling/dismissing, then use locale-scoped
  endpoints and refresh the inbox. A locale outage cannot be filled as a text key.
- **TC-6:** Given dirty editor work, when changing locale or applying an import,
  then require an explicit discard decision rather than losing input.
- **TC-7:** Given zero, some, or all original locale rows, then the readiness panel
  marks each original locale as missing, imported/inactive, or imported/active;
  missing locales open the import flow with that locale selected.

Run `pnpm test:admin`, lint/build, and the local Admin smoke flow with keyboard
navigation and a 600-field import. The readiness tuple is the only fixed locale
set; do not hardcode extra languages or country mappings.
