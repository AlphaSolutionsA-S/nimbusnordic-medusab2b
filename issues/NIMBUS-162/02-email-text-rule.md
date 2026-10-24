# 02: Email text rule and escaping
**App:** backend · **Layer:** L5 · **Depends on:** None · **Parent:** NIMBUS-162

**Goal:** One pure function that resolves an email's texts per key (chosen language → English → built-in copy), fills `{name}` placeholders, and lists the fallbacks to report; plus a pure HTML-escaping helper.
**Files / areas:** `apps/backend/src/workflows/transactional-email/utils/`, `ai/architecture/decisions.md` (built-in English copy row, "approved fallback copy", like the cold-outage country map).
**Seam contracts:** input `{ keys: Record<string, string> /* full key → built-in English */; locale: string; chosen: MessageDocument | null; english: MessageDocument | null; values: Record<string, string>; source: string }` → `{ texts: Record<string, string> /* plain, filled, unescaped */; fallbacks: MissingReport[] /* kind "key", page_path = source */ }`. Escaping helper: `escapeHtml(text: string): string` (`& < > " '`). Builders (03, 05) escape after filling.
**Test intent:** unit:
- per-text fallback: one key missing in `da` → that text English, others Danish, one `da` report.
- blank (whitespace) counts as missing; English missing too → built-in, reports for `da` and `en` keys; locale `en` → only the `en` report.
- `chosen` null (language unavailable) → English texts, no `da` reports.
- unknown placeholder or ICU plural in a text → next source, no report for it; a value containing `{companyName}` is not re-expanded.
- `escapeHtml` on `<script>`, quotes, `&`; report `page_path` equals the source and contains no value.
**Done when:** tests pass; registry row added.
**Also update:** `ai/architecture/decisions.md`; none found otherwise.

## Deviations

- Root `AGENTS.md` is now 33103 bytes (limit 32768; 32910 after task 01), so `pnpm ai:check` still
  fails on size; the registry row is as compact as I could make it and no other Tier 0 text was
  trimmed (escalated human decision, as instructed).
- Rich-text tags (`<b>`) in a text are read as literal text (`parse(..., { ignoreTag: true })`), not as
  unusable: the builders escape them, so they show literally. Why: "odd characters shown literally"
  (plan section 7); the task only names placeholders and plurals as unusable.
- Added: a built-in copy that cannot be filled (e.g. a placeholder whose value the builder did not
  pass) throws `MedusaError` `UNEXPECTED_STATE`, a code defect rather than a fallback case.
- Added cases: a group stored where a text is expected counts as missing; an unusable English text
  goes to the built-in copy without a report; an unavailable English document gives no `en` reports.
- `escapeHtml` lives in its own file `escape-html.ts` (one test file per module).

## Done-when evidence

- Tests pass: `apps/backend/src/workflows/transactional-email/utils/__tests__/email-texts.unit.spec.ts`
  (16 tests) and `escape-html.unit.spec.ts` (4 tests) pass; each test-intent bullet maps to:
  per-text fallback "falls back to English for one missing text only…"; blank/built-in "treats a blank
  text as missing and uses the built-in copy…"; `en` "reports only the English key when the chosen
  language is English"; `chosen` null "uses English texts without reports…"; unknown placeholder /
  ICU plural `it.each` "moves past a text with %s…"; no re-expansion "does not expand placeholders
  inside a supplied value"; escaping "escapes a script tag", "escapes double and single quotes…",
  "escapes an ampersand once…"; report contents "puts only the key, locale and source in a report…".
- Registry row added: `ai/architecture/decisions.md` row "Email text fallback: language, English,
  built-in"; `pnpm ai:check --fix` regenerated `AGENTS.md` and `.github/copilot-instructions.md`.
- Also update `ai/architecture/decisions.md`: row added (above). No other doc or test asserts this
  behaviour (new code).
