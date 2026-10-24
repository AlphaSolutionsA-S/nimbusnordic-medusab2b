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
