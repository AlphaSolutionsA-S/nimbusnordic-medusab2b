# NIMBUS-250 progress

## 2026-10-26 — Registered

- Outcome: bug registered in Jira (Bug, parent epic NIMBUS-206, component Customer Portal) and
  mirrored in `bug.md`. Found when the storefront `product-tabs` tests failed after a lockfile
  reinstall during NIMBUS-162; the cause was traced to an undeclared `@radix-ui/react-accordion`
  resolving to a React 18 copy. Not yet checked whether a production build is affected.
- Next owner: triage, to route it (likely quick-fix: storefront only, cause known).
- Handover prompt: "Triage NIMBUS-250 (issues/NIMBUS-250/bug.md): storefront product tabs resolve an
  undeclared @radix-ui/react-accordion bound to React 18."
