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
