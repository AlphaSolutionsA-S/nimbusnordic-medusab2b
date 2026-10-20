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
