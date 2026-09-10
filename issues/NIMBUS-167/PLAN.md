# NIMBUS-167: Translated Content for All Locales

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-167

## Objective
Machine-translate the English message catalogs (produced by NIMBUS-165) into the 7 remaining
locales and load them, with no formal human review step.

## Analysis
- This story is purely a data-generation pass over `apps/storefront/messages/*.json` — no
  storefront runtime code changes are needed beyond a small translation script.
- The one real technical risk is protecting ICU interpolation placeholders (`{var}`) and
  next-intl rich-text tags (e.g. the `{br}` tag from NIMBUS-165's login heading extraction) from
  being mangled by MT — most providers support "do not translate" markup, and the script is
  designed to verify this mechanically (Task 02) rather than trust it blindly.
- **MT provider: DeepL.** Scope.md didn't name one; DeepL was selected specifically because all 7
  target locales (da, sv, no, pl, it, fr, de) are European languages, where DeepL is generally
  regarded as the strongest MT engine — a good match for a story that ships MT output with no
  human review. Norwegian requires DeepL's `nb` code, not `no` — handled via an explicit mapping in
  the script.

## Execution Plan
1. **Task 01:** build a re-runnable, idempotent translation script that walks `en.json` and
   produces the 7 target locale files via the chosen MT provider, preserving key structure and
   placeholders.
2. **Task 02:** add an automated sanity check (not a linguistic review, per scope) catching
   mechanical MT failures — untranslated leftovers, broken placeholders.

## Decisions & Trade-offs
- No human review step, per explicit stakeholder decision in scope.md — Task 02's check is
  intentionally mechanical-only (placeholder integrity, obvious no-op translations), not a
  linguistic quality gate.
- Script is idempotent by default (skips keys with existing non-English content) with a `--force`
  override, so re-running after NIMBUS-165 adds more keys later doesn't re-translate (and
  re-cost) everything from scratch.

## Verification
- [ ] Translation script preserves placeholders and rich-text tags (TC-1, Task 01).
- [ ] Re-running without `--force` doesn't re-translate already-translated keys (TC-2, Task 01);
      `--force` does (TC-3, Task 01).
- [ ] All 7 target catalogs have identical key structure to `en.json` (TC-4, Task 01).
- [ ] Sanity check finds no suspiciously-untranslated values or broken placeholders (TC-1/TC-2,
      Task 02).
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass.
