# Branch notes

## Task 01 — store quote projection

- Production change is limited to `apps/backend/src/api/store/quotes/query-config.ts`; both configs share a normalized exact allowlist and local depth four.
- Sensitive relation parents must not enter `allowed`: the installed library treats bare allowed relation paths as permission for scalar wildcards.
- `draft_order_id` is now explicit in defaults (preview requires it); safe sorting fields and additive `draft_order.is_draft_order` remain allowed.
- Public middleware tests: `src/api/store/quotes/__tests__/query-config.unit.spec.ts`, 20 passing tests; retrieve intentionally omits pagination sorting but still validates the sort field.
- HTTP matrix covers all routes and both employee roles; creation has no messages, so author projections are populated on subsequent responses.
- Scoped HTTP suites cannot start without an allowed `BUSINESS_CENTRAL_DISCOVERY_URL`; process/User scopes also have no database configuration. Do not bypass the guard or authentication to get green tests.
- Backend tsc remains exactly at the measured 22-error baseline; storefront tsc has 58 errors in untouched code.
- Lint completes with zero errors / 13 existing warnings using `XDG_CONFIG_HOME` under the run scratchpad. Default user config is outside sandbox write access.
- `ai:check` passes; keep the registry concise because generated `AGENTS.md` is close to its enforced size limit.
- Review fix: `productSeeder` ignores `data`; the quotes HTTP fixture explicitly updates publication/channel via the Admin API and asserts both before cart creation.
