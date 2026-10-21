# Protect company-linked carts from access by cart ID alone

- **Date:** 2026-10-01
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-177
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-177/
- **Updated by:** feature skill
- **Outcome:** Feature captured; scoping is the next stage.
- **Handover to:** scoper agent
- **Handover prompt:** Define the authorization model for company-linked and anonymous carts, including Medusa's built-in cart routes and the custom bulk line-item route. Specify ownership rules, guest-cart behavior, rollout impact, and API security tests in `issues/NIMBUS-177/SCOPE.md`.

## 2026-10-20 — Draft scope prepared

- **Outcome:** Created `scope.md` with direct/indirect cart access requirements, draft business rules, data inventory, security properties, rollout treatment and verification expectations. Scope is a draft, not approved. Existing upper-case intake/progress filenames retained; new scope uses the current lower-case convention.
- **Evidence:** Targeted code/installed Medusa source research confirms approval freezing is separate from access authorization; current company–cart linkage derives from client-influenced metadata. Administrator approval currently leads to payment for the colleague's cart and must be covered explicitly. No live HTTP probes or implementation changes were performed.
- **Open decisions:** Guest purchasing carts, same-company colleague and administrator completion rights, and treatment of legacy carts with ambiguous ownership/company data.
- **Tracker:** NIMBUS-177 remains Scoping, assigned to Klaus Petersen with Customer Portal component. Related-issue search performed; no duplicate cart-access item found. No approval comment, ready transition or sub-tasks created.
- **Next owner:** Klaus Petersen for business decisions and draft scope review; scoper to revise afterward.
- **Handover prompt:** Answer Q1–Q3 in `scope.md`, then review and approve the complete scope including business rules and data model. Scope approval and permission to start implementation planning are separate decisions.

## 2026-10-20 — Scope approved and finalized

- **Outcome:** Klaus Petersen replied "all ok", approving the scope and all three recommended decisions. `scope.md` now records sign-in before purchasing cart creation/use, personal carts with administrator approval/payment completion access for approved colleague carts, and preservation of verified existing carts with refusal of ambiguous carts until trusted recovery or a new cart. Replaced provisional questions and dependent wording throughout; no business decisions remain open.
- **Tracker:** Added approval comment 254760 with the agreed rules, remaining technical verification and scope link. Applied the available "Scope approved" transition (611), then read Jira back and confirmed NIMBUS-177 is in Estimation with the approval comment present. Assignee and Customer Portal component retained; description unchanged.
- **Verification:** Reviewed the scope for remaining Q1–Q3/provisional decision references. Documentation and tracker updates only; no implementation, tests, deployment or delivered authorization change.
- **Next owner:** Klaus Petersen for a separate planning handoff instruction; implementation-planner after that instruction.
- **Handover prompt:** When explicitly authorized, hand `issues/NIMBUS-177/` to implementation-planner. Use the approved business rules, verify installed framework behavior and complete the draft data/security tables before proposing the implementation plan. Scope approval alone has not started planning.

## 2026-10-20 — Implementation plan drafted

- **Outcome:** implementation-planner wrote `plan.md`, `manifest.md` and task files `01`–`05` after verifying installed Medusa 2.21.0 behaviour (global optional store auth, middleware ordering, cart create/update/transfer, payment-collection and shipping-option routes) and Next.js 15.5.18 server-action origin checks. Design: one pure cart-access decision run by one guard middleware on every direct and indirect cart route; sign-in required for all cart routes including creation; company link derived from the owner's employee record; existing carts judged per request (no migration). No framework assumption is UNVERIFIED. `Ready for Dispatch: false`.
- **Tracker:** created sub-tasks NIMBUS-199 to NIMBUS-203 (component Customer Portal) under NIMBUS-177, at the caller's instruction before plan approval; keys recorded in the manifest. No "plan approved" comment yet.
- **Open decisions:** plan section 2 — no recovery tooling for ambiguous carts; protect cart-scoped shipping-option routes; `GET /store/orders/:id` as a follow-up issue.
- **Next owner:** Klaus Petersen to review `plan.md` and answer section 2.
- **Handover prompt:** Review `issues/NIMBUS-177/plan.md` by its review levels and answer "Needs your decision". On approval, implementation-planner sets Ready for Dispatch, records "plan approved" in Jira, and asks separately whether to hand off to task-dispatcher. A competing-model review is recommended (security, payment paths).

## 2026-10-20 — Plan revised with Klaus Petersen's answers

- **Outcome:** Klaus answered plan section 2: "1 ok, 2 OK, 3 protect with this as well". Recorded as answers in `plan.md`. Decision 3 brought store order-by-ID routes into this plan: verified in installed 2.21.0 that `GET /store/orders/:id` is unauthenticated, that `POST /store/orders/:id/transfer/request` lets any signed-in customer request any order not already theirs and returns it in full, and that `POST /store/returns` creates and completes a return for any `order_id` without sign-in. Added flow F, an order state table (owner; administrator only via the source cart's company link and approved admin approval; never the metadata-derived order–company link), security row, framework rows and new task `06-order-access-guard.md` (depends on 01, 03; runs before 04). Tasks 04 (order fetches no-store) and 05 (order rules, finding 8 status) extended.
- **Tracker:** created NIMBUS-204 (Customer Portal) for task 06; scope-widening comments on NIMBUS-202 and NIMBUS-203. No "plan approved" comment.
- **Open decisions:** new decision 4: may a customer who left the company still read orders they placed? Default yes (matches the core order list).
- **State:** not approved; `Ready for Dispatch: false`; nothing dispatched.
- **Next owner:** Klaus Petersen to answer decision 4 and approve the plan.
- **Handover prompt:** Answer decision 4 in `issues/NIMBUS-177/plan.md`, then approve or revise. On approval, implementation-planner records "plan approved" in Jira and sets Ready for Dispatch; handoff to task-dispatcher needs a separate instruction.

## 2026-10-20 — Plan revised: order transfer kept open without order data

- **Outcome:** Klaus Petersen answered "can you leave request transfer open for all signed in 4 ok", then "keep transfer open but dont return order". `POST /store/orders/:id/transfer/request` stays open to signed-in customers (core already answers 401 signed out); a project route file replaces core's handler, runs core's workflow and answers `200 { "success": true }`. Decision 4 recorded: owners always read their own orders. Proposed decision 5: transfer cancel keeps core's requester-only rule but gets the same minimal response, because core's cancel response returns the full order to the requester. Verified from installed source: no subscriber for `order.transfer_requested`, the token is in no store response, a pending transfer request blocks every other order change, accept switches the order's customer to the requester. Residual exposure recorded in `plan.md` section 10. Task 06, manifest and task 05 updated.
- **Tracker:** comment on NIMBUS-204 with the changed goal. No "plan approved" comment.
- **Open decisions:** decision 5 (transfer cancel response), default: minimal response.
- **State:** not approved; `Ready for Dispatch: false`; nothing dispatched.
- **Next owner:** Klaus Petersen to answer decision 5 and approve the plan.
- **Handover prompt:** Answer decision 5 in `issues/NIMBUS-177/plan.md` and approve or revise. On approval, implementation-planner records "plan approved" in Jira and sets Ready for Dispatch; dispatch needs a separate instruction.

## 2026-10-20 — Plan approved

- **Outcome:** Klaus Petersen answered "D5 ok / 2 yes refuse / 3 the approved". Decision 5 accepted (transfer cancel keeps core's rule, answers `{ "success": true }`). Decision 6 added: transfer requests are refused when `order.customer_id` is a customer with `has_account = true` (verified fields in installed `@medusajs/customer` and `@medusajs/order` 2.21.0); refusal is 400 `invalid_data` "Order cannot be transferred", runs before core's request workflow (which has no hook), and gives the same answer for the caller's own order and another account's order. Task 06, task 05, manifest and plan sections 2, 4, 6, 7, 8, 9 and 10 updated. Plan approved by Klaus with these changes; `Ready for Dispatch: true` (no UNVERIFIED rows).
- **Tracker:** "plan approved" comment on NIMBUS-177 with decisions 1–6; comment on NIMBUS-204 with the extended goal. Sub-tasks NIMBUS-199–204 already exist and are in the manifest. No status transitions.
- **Remaining accepted exposure:** order existence and account-ownership are inferable from transfer-request errors; orders without an account owner (order API orders, guest orders) can still receive a blocking transfer request.
- **Next owner:** Klaus Petersen for a separate go-ahead to dispatch; then task-dispatcher.
- **Handover prompt:** When Klaus explicitly says to start implementation, run task-dispatcher on `issues/NIMBUS-177/manifest.md` (branch `feature/NIMBUS-177` from develop; task order 01, 02, 03, 06, 04, 05). Plan approval is not that go-ahead.

## 2026-10-20 — Plan reopened after external review

- **Outcome:** Four external-review findings checked against the code. Finding 1 (administrator returns) is a business-rule change: added as decision 7, default owner-only, both variants written into the order table and task 06 tests. Finding 2 confirmed: `api/store/approvals/route.ts` lists company carts with items and cart fields by the stored company link alone. Finding 3 confirmed: `workflows/approval/steps/validate-company-approval.ts` checks the administrator against the link but not the owner's current membership. New task `07-approval-routes-association.md` applies the task 01 verified-association predicate to the list and the decision. Finding 4: task 06 now has a real cart-completion HTTP test for two administrators reading the order. Clarified that the plan's order rule allows any qualifying administrator of the source cart's company, not only the approver. Also noted, not in scope: quote fields expose every company field to the quote owner.
- **Tracker:** created NIMBUS-205 (task 07, Customer Portal); comment on NIMBUS-204. No comment on NIMBUS-177 until Klaus re-approves.
- **State:** `Ready for Dispatch: false`; nothing dispatched.
- **Next owner:** Klaus Petersen to answer decision 7 and re-approve the revised plan.
- **Handover prompt:** Answer decision 7 in `issues/NIMBUS-177/plan.md` and approve the revision. On re-approval, implementation-planner adds an "agreed rule or decision changed" comment on NIMBUS-177 and sets Ready for Dispatch; dispatch (order 01, 02, 03, 07, 06, 04, 05) needs a separate go-ahead.

## 2026-10-20 — Revised plan approved

- **Outcome:** Klaus Petersen chose decision 7 option A (qualifying administrators may create returns, same conditions as order read) and approved the revised plan ("plan approved"), including task 07. Applied option A in `plan.md` (decision 7, flow F5, order table classes `read` and `return`, security matrix, decisions) and task 06 tests (positive administrator return in the end-to-end test; refusals for no approval, pending or rejected approval, owner left, other company, non-admin colleague); removed the owner-only variant; task 05 scope updated. No decision is open. `Ready for Dispatch: true`.
- **Tracker:** "agreed rule or decision changed" comment on NIMBUS-177 (review findings 2–4, decision 7 option A, NIMBUS-205); comment on NIMBUS-204 with the changed goal. No status transitions.
- **Next owner:** Klaus Petersen for a separate go-ahead to dispatch; then task-dispatcher.
- **Handover prompt:** When Klaus explicitly says to start implementation, run task-dispatcher on `issues/NIMBUS-177/manifest.md` (branch `feature/NIMBUS-177` from develop; task order 01, 02, 03, 07, 06, 04, 05). Plan approval is not that go-ahead.

## 2026-10-21 — Implementation done, at the implementation gate

- **Updated by:** task-dispatcher.
- **Outcome:** All seven tasks are done, reviewed and committed locally on `feature/NIMBUS-177` (from develop e4f7351):
  - 01 aa91186, 02 578fd82, 03 4e292aa, 07 e99a94b, 06 dbdfee3, 04 5a3b7ce, 05 805f3ff;
  - fix for a cookie cart the customer can read but not own (Klaus's decision) 79d96c1;
  - consolidation 7e3985f;
  - integration fixes M1–M3 5476a92.
- **Whole-branch pass:**
  - Finalization: only baseline failures remain. This includes `admin/shipment-tracking.spec.ts`, which also fails on develop but is not in the recorded baseline.
  - Typecheck is at the baseline (backend 22, storefront 8), with lint at 0 errors and the backend build passing.
  - The storefront build compiles but needs a reachable backend to collect page data.
  - `pnpm ai:check` fails on the `AGENTS.md` size, as it did before this branch.
  - `deviation-report.md` is written; the integration re-review approved it.
- **Tracker:**
  - NIMBUS-177: Klaus approved the estimate; it is now In Progress.
  - NIMBUS-199 to NIMBUS-205: Done, with closing comments.
- **Not pushed.** No PR exists.
- **Next owner:** Klaus Petersen, to answer the deviation report's open questions 1–5.
- **Handover prompt:** Answer the open questions in `issues/NIMBUS-177/deviation-report.md`, then re-invoke task-dispatcher on `issues/NIMBUS-177` to resume at "After the gate". The answers are not a push instruction.
