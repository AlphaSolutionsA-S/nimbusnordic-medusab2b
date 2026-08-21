# Ensure Business Central company data is fresh before viewing Company page

- **Date:** 2026-08-21
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-160/
- **Size:** TBD (T-shirt) — pending scoping
- **Area:** Storefront account — Company page / Backend `/store/companies/[id]`
- **Base Branch:** develop
- **Requested by:** User (via chat session)
- **Requested at:** 2026-08-21T00:00:00Z

## Description
When a customer accesses the Company page, the system should ensure the company's Business Central data has been synced within the last 10 minutes before showing it. If the last sync is missing or older than 10 minutes, the system should run the sync first and then show the (now fresh) data.

## Why
Company data (address, credit limit, blocked status, etc.) is sourced from Business Central. Today, a sync only happens on login. If a customer's session is long-lived, or BC data changes mid-session, the Company page can show stale data indefinitely. Automatically refreshing on a 10-minute cadence keeps the page trustworthy without requiring a manual sync action or a full re-login.

## Acceptance criteria
- [ ] When a customer opens the Company page, the system checks whether Business Central data was synced within the last 10 minutes.
- [ ] If the last sync is missing or older than 10 minutes, the system triggers a sync before the company data is returned/displayed.
- [ ] If the last sync is within 10 minutes, no extra sync call is made.
- [ ] The freshness check is reliable across devices/browser sessions for the same company (not lost on cookie clear, new tab, or different device).
- [ ] If the sync attempt fails, the customer still sees the existing company data (no hard error on the page).

## Out of scope
- Changing the existing login-triggered sync behavior.
- Real-time/websocket updates of company data.
- Exposing manual "sync now" controls in the UI (unless scoping determines it's needed).

## Open questions
- Should the freshness check live purely in the backend (`GET /store/companies/[id]`), or does the storefront also need awareness of "last synced at" for display purposes?
- Should a failed sync attempt still count as "attempted" for the purposes of the 10-minute throttle (to avoid hammering Business Central on repeated failures)?

## Mockups / references
- None provided.

## Technical notes
*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts — do not mix it into the feature description.)*
