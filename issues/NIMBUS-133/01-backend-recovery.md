# 01: Backend recovery and email
**App:** backend · **Layer:** L6, L7, L4/L3 · **Depends on:** None
**Goal:** Reuse core customer/emailpass recovery and send English instructions through existing Notification channel `email`.
**Files / areas:** src/api/auth/, api/middlewares.ts, subscribers/, workflows/customer/; existing HTTP security specs.
**Seam contracts:** Core POST /auth/customer/emailpass/reset-password accepts email; POST /auth/customer/emailpass/update accepts reset Bearer proof and password, with project confirmation validation. Use the exact static update matcher before core parameterized middleware (verified sample). Notification links to a trusted country-prefixed storefront reset page.
**Test intent:**
- HTTP neutral known/unknown acknowledgement; no account creation; tamper/wrong actor/provider/identity substitution refused.
- Server minimum eight and matching confirmation before consumption; HTTP regression proves valid-retry semantics.
- Core expiry, sequential reuse and supersession; concurrent reuse is accepted, no one-winner assertion.
- Notification uses email and existing configuration; no new password logs or provider details in UI-facing errors.
**Done when:** Valid recovery and negative cases pass scoped checks against baseline.
**Verify after deploy:** Controlled mailbox/account reset; provider acceptance proves dispatch only.
**Also update:** Existing security-boundaries.spec.ts and customer password regression tests where affected; current docs consolidation is 03.
