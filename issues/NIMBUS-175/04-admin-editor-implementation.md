# Task 04: Admin test harness and core editor

**Status:** DONE
**App:** backend Admin
**App Root:** apps/backend
**Task ID:** 04
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 01, 03

## Environment and references

Load building-admin-dashboard-customizations and its data-loading, forms,
display-patterns, navigation, and typography references. Use the supplied screenshot
and Medusa UI tokens. Scope explicitly asks for inline editable fields, so follow
that layout rather than the skill's generic read-only container/Edit-button pattern.
SDK: `src/admin/lib/client.ts`; React 18, React Query 5.64.2, Medusa UI 4.2.4.

## Dedicated test configuration

Add `jest.admin.config.js` with jsdom, `**/src/admin/**/__tests__/**/*.test.tsx`,
SWC transform `^.+\\.[jt]sx?$` using TSX parser and automatic React transform,
extensions ts/tsx/js/json, and setup `src/admin/__tests__/setup.ts`. Do not import
the backend integration globalSetup into this UI-only config. Add script
`test:admin: jest --config jest.admin.config.js --runInBand` and React-18-compatible
Testing Library/user-event/jest-dom plus `jest-environment-jsdom` matching Jest29.
The setup imports jest-dom and stubs ResizeObserver as in the storefront setup.
Keep React Query/router pinned to the dashboard versions already installed.

## New file skeletons

`src/admin/hooks/api/ui-translations.tsx`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import type { LocaleSummary, MutationResponse, TranslationDocument, MessageDocument }
  from '../../../types/storefront-translation';

export const translationKeys = {
  all: ['ui-translations'] as const,
  detail: (locale: string) => ['ui-translations', 'locale', locale] as const,
  missing: (locale?: string) => ['ui-translations', 'missing', locale ?? 'all'] as const,
};
export function useTranslationLocales() {
  return useQuery({ queryKey: translationKeys.all,
    queryFn: () => sdk.client.fetch<{ locales: LocaleSummary[] }>('/admin/ui-translations') });
}
export function useTranslation(locale: string) {
  return useQuery({ queryKey: translationKeys.detail(locale), enabled: Boolean(locale),
    queryFn: () => sdk.client.fetch<{ translation: TranslationDocument }>(
      `/admin/ui-translations/${encodeURIComponent(locale)}`) });
}
export function useSaveTranslation(locale: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { expected_version: number; messages: MessageDocument }) =>
      sdk.client.fetch<MutationResponse>(`/admin/ui-translations/${encodeURIComponent(locale)}`,
        { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: translationKeys.all }),
  });
}
```

`src/admin/routes/translations/page.tsx`:

```tsx
import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading } from '@medusajs/ui';
import { TranslationEditor } from './components/TranslationEditor';
export default function TranslationsPage() {
  return <Container><Heading>Translations</Heading><TranslationEditor /></Container>;
}
export const config = defineRouteConfig({ label: 'Translations' });
```

`src/admin/routes/translations/components/TranslationEditor.tsx`:

```tsx
import { useState } from 'react';
import { Button, Input, Label, Select, Tabs, Text, Textarea } from '@medusajs/ui';
import { useTranslationLocales, useTranslation, useSaveTranslation }
  from '../../../hooks/api/ui-translations';
import { flattenMessages, labelForKey, updateMessageLeaves }
  from '../../../../utils/translations/documents';
import type { MessageDocument } from '../../../../types/storefront-translation';

export function TranslationEditor() {
  // IMPLEMENT: locale selection; loading/empty/error states; versioned draft;
  // active section; global search; inline fields; explicit save; conflict panel.
}
```

These imports are relative to the components directory. Keep helpers browser-safe;
do not create duplicate document helper implementations for Admin.

## Behavior

- Load locale list on mount; enable detail once a locale is selected, independently
  of whether an import modal is open. Keep initial empty state usable for Task 05.
- Draft owns a captured locale/version and values. Loading or re-fetching English
  for warnings must not reset dirty local inputs. Global search checks all keys and
  values, even outside the active tab; results retain section/group context.
- Save by applying draft leaf values to the captured original document with
  `updateMessageLeaves`; do not rebuild the persisted tree from flattened leaves.
  Keep empty nested groups and all unchanged structure.
- Use section tabs and grouped labelled text fields from the mockup. Multiline
  values use Textarea; values remain literal text. Render one section or search
  results, rather than keeping 600 mounted hidden fields. Warn before locale
  switching with unsaved changes. Mark loading and disabled save state accessibly.
- 409 keeps the draft visible with an explicit reload/discard action; never silently
  retry against a new version. On successful save adopt the returned version/data
  and invalidate list/detail/missing queries. Show ICU warnings without blocking.
- Backend errors show a safe user-facing message. Refresh-deferred is a nonfatal
  notice; do not tell the admin a persisted save failed because a callback timed out.

## Tests and scaffolding

Create `src/admin/routes/translations/__tests__/editor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TranslationEditor } from '../components/TranslationEditor';
// Mock the SDK boundary, not the editor or useMutation implementation.
// Fresh QueryClient per test; retry:false; populate responses with contract DTOs.
```

- **TC-1:** Given two namespaces, when editing and saving a field, then the request
  carries the captured version and complete document; a success updates the draft.
- **TC-2:** Given a 409, then typed values remain visible and only explicit reload
  discards them. A reference-language query update also preserves the draft.
- **TC-3:** Given a match in a hidden section, when searching key or value, then
  show it with the right label/path and no accidental key rename/delete controls.
- **TC-4:** Given empty/loading/error locale responses, then show the corresponding
  state and retry/create affordance. Anonymous behavior remains an API test.
- **TC-5:** Given ICU warnings, then save remains available; malicious HTML-like
  text is displayed literally, never executed.
- **TC-6:** Given a document with an empty nested group, when editing a leaf and
  saving, then that empty group remains in the submitted document.

Run `pnpm test:admin`, backend lint/build, and a keyboard smoke test at
`http://localhost:9000/app/translations` after starting the local backend.
