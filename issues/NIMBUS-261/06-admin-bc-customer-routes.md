# 06: Admin routes: status, two-environment check, "Use this customer"
**App:** backend · **Layer:** L6 routes, L4 workflows, L3 steps · **Depends on:** 05

**Goal:** Admin users can see a company's routed environment and not-found record, check its customer number in both environments, and move the company to the customer card they pick.
**Files / areas:** `api/admin/companies/[id]/business-central-customer/**`, `api/admin/companies/{middlewares,validators}.ts`, `workflows/company/` (new lookup and use workflows and steps), `types/company/http.ts`.
**Seam contracts:**
- `GET /admin/companies/:id/business-central-customer` → `{ routed_environment: "DK"|"NO", customer_number: string|null, not_found: { at: string, environment: "DK"|"NO", customer_number: string } | null }` (task 02 workflow with `{ companyId }`).
- `GET /admin/companies/:id/business-central-customer/lookup` → `{ customer_number: string, results: [{ environment: "DK"|"NO", status: "found"|"not_found"|"could_not_check", customer: { name: string, country: string, routes_to: "DK"|"NO", routes_elsewhere: boolean } | null }] }`, one result per environment; 400 when the company has no customer number; 404 unknown company.
- `POST /admin/companies/:id/business-central-customer/use`, strict body `{ environment: "DK"|"NO" }` → `{ status: "updated"|"skipped"|"failed", country: string }`; 404 unknown company or card not found in that environment (nothing written); 400 no customer number or invalid body.
- Use workflow: re-read step, `updateCompaniesStep` with its own `.config({ name })` writing only `country`, then `syncCompanyFromBusinessCentralWorkflow.runAsStep({ input: { companyId } })`.
**Test intent:**
- Contract (`companies.spec.ts`, BC module spied): lookup found in DK only, NO only, both, neither; one environment throwing → `could_not_check` there and the other result intact; found card with country `SE` in NO → `routes_to: "DK"`, `routes_elsewhere: true`; response has no address, email, VAT or credit fields.
- Contract: use with `NO` → `country` set to the NO card's country, sync runs against NO, not-found record cleared, response `{ status: "updated", country }`; card gone → 404 and `country` unchanged; body `{ environment: "NO", country: "NO" }` or `{ environment: "SE" }` → 400.
- Security (`security-boundaries.spec.ts`): none / customer / publishable credentials on all three routes → 401, BC module not called, company row unchanged.
- Logs in the lookup step carry company id and environment only (assert on the logger mock in the contract case where one environment fails).
**Done when:** every route body is within 40 lines with no `if` on a domain value, the use workflow writes `country` only from the re-read card, and typecheck shows no new errors.
**Verify after deploy:** on the Admin page of one test company with a Norwegian number and country `DK`, "Use this customer" for NO sets `company.country` to `NO` and the next store BC read goes to TestNO.
**Also update:** `docs/architecture/business-central-company-sync.md` left to `documentation-writer`; none found otherwise.
