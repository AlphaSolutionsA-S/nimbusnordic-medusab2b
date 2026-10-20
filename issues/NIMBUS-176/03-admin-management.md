# 03: Add Admin assignment management and feedback
**App:** Medusa Admin · **Layer:** Admin HTTP UI · **Depends on:** 02

**Goal:** Let Admin users view effective/default country languages and edit configured or existing retained entries; communicate failures and language-deactivation blockers clearly.
**Files / areas:** apps/backend/src/admin/routes/translations/; src/admin/hooks/api/ui-translations.tsx; src/admin/lib/translations.ts as needed; routes/translations/__tests__/.
**Seam contracts:** Consume 02 management DTO and POST with displayed version; existing activation errors provide affected country codes in message. Approved retained-entry rule permits replacement only; no unconfigured new entry control.
**Test intent:**
- RTL: loading/error state on mount, configured default versus explicit labels, retained section and active-language choices including a ninth canonical tag.
- RTL: pending disables submission, keyboard-accessible edit, save failure retains previous saved display, stale-version reload and successful list/language refresh.
- RTL: English and referenced-language refusal messages remain visible and identify retained countries; retry after reassignment uses refreshed state.
**Done when:** User can complete assignment and recovery flows with keyboard and SDK-backed hooks; component behavior tests pass. Reload medusa-admin and its forms/data-loading/display references before implementation.
**Verify after deploy:** Translations country-language view shows dk and its effective/default source; save a configured test country to nl and read back the displayed saved language/version.
**Also update:** Existing routes/translations/__tests__/{tools,editor}.test.tsx and any workspace/tools deactivation UI; no separate new translation-editor design.

## Deviations

- Language choice uses a Medusa `Select` only, not the plan's "Select scaling to searchable table selection for larger active-language lists": active languages are a small set (9 in the tests), and `select-small-datasets` covers it. A searchable picker can be added when the active list passes about 10.
- A 409 from a country-language save or from language activation now shows the server's domain message (new `conflictAwareErrorMessage` in `src/admin/lib/translations.ts`). The old generic 409 text ("Someone else changed this language…") would hide the English and referenced-language refusals. Other routes keep `safeErrorMessage`.
- A successful activation or deactivation now also invalidates the country-language query, because it changes which languages a country can be given (tested: a deactivated language disappears from the choices).
- Deactivation confirm text updated: it said customers would see raw keys, which can no longer happen. It now says an assigned language cannot be deactivated.
- A default-source country may be saved explicitly with its current default language (`en`), which turns it into an explicit entry. Save is disabled only when an explicit entry is unchanged.
- Added cases: 503 "not set up" message, and the deactivated language dropping out of the choices after a refresh.

## Done-when evidence

- Assignment flow with keyboard and SDK-backed hooks: `__tests__/country-languages.test.tsx` › "edits a country with the keyboard, posts the displayed version and refreshes lists" (Enter on Edit, arrow keys in Select, Enter on Save; POST `/admin/country-languages/dk` `{locale, expected_version: 3}` through `sdk.client.fetch`).
- Loading/error on mount: "loads on mount and labels default and explicit languages…" (status text) and "shows an error with retry, and says when country languages are not set up".
- Default versus explicit labels and retained section: "loads on mount and labels default and explicit languages, with retained entries apart" (no add control).
- Active-language choices including a ninth tag: "offers every active language, including a ninth canonical tag" (`nl`).
- Pending disables submission: "disables submission while the save is pending" (Save and Cancel disabled, a second click sends nothing).
- Save failure keeps previous saved display: "keeps the previously saved language displayed when a save fails".
- Stale-version reload: "explains a stale version and saves with the reloaded version" (second POST carries version 4).
- List/language refresh on success: keyboard test asserts the language list query is invalidated and the country list is fetched again; `tools.test.tsx` refusal test shows the refreshed list after each save.
- English refusal stays visible: `tools.test.tsx` › "keeps the refusal to deactivate English visible".
- Referenced-language refusal names retained countries; retry after reassignment uses refreshed state: `tools.test.tsx` › "names configured and retained countries blocking deactivation; the retry after reassignment succeeds" (message lists `no, se`, `no` being retained; reassign both; deactivation succeeds; `sv` drops out of the choices).
- Component behaviour tests pass: `pnpm --filter @b2b-starter/backend test:admin -- src/admin/routes/translations` gives 4 suites, 38 tests passed.
- Reload medusa-admin and its references: SKILL.md, project.md, references/forms.md (Drawer edit, pending rules), data-loading.md, display-patterns.md read before implementation.
- Verify after deploy: not provable in this task; it needs a deployed backend with an initialized configuration.
- Also update `tools.test.tsx`: its fake backend now serves `GET/POST /admin/country-languages` and the activation refusals; 2 cases added.
- Also update `editor.test.tsx`: no change needed. It renders `TranslationEditor` alone, and the editor did not change.
- Also update workspace/tools deactivation UI: `TranslationTools.tsx` (confirm text, domain 409 message) and `TranslationsWorkspace.tsx` (renders `CountryLanguages`).
