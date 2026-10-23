# Manifest: Forgotten password

**Key:** NIMBUS-133
**Issue:** NIMBUS-133
**Branch:** feature/NIMBUS-133 (from develop)
**Ready for Dispatch:** true

## Conventions and commands
Backend scoped tests: `pnpm --filter @b2b-starter/backend test:unit -- <path>`; HTTP: `pnpm test:integration:http` requires PostgreSQL and allowlisted BC test environment. Storefront scoped: `pnpm --filter @b2b-starter/storefront test -- <path>`.
Each affected app runs filtered `lint` and `exec tsc --noEmit` against recorded baselines. Full suites/integration/build once at finalization. Test locations follow ai/architecture/verification.md. No new module/migration.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|---|---|---|---|---|---|---|
| 01 | Backend recovery and email | `01-backend-recovery.md` | Backend | Core customer-bound recovery, neutral reply, sequential single-use/latest links, server validation, English Notification email | None | NIMBUS-228 | DONE |
| 02 | Public translated recovery | `02-storefront-recovery.md` | Storefront | Login entry, public forms, country routing, translated accessible states, normal login afterward | 01 | NIMBUS-229 | DONE |
| 03 | Verification and documentation | `03-verification.md` | Both | Security negatives, regression, cross-app checks, architecture and delivery evidence | 01, 02 | NIMBUS-230 | DONE |

## Scope items with no task
| Scope item | Reason |
|---|---|
| New provider/domain provisioning | Explicitly excluded; existing configuration |
| Existing session revocation | Core default accepted |
| Token log/persistence hardening | Existing behaviour explicitly accepted |
| Concurrent token-use protection | Risk explicitly accepted; no custom locks/storage |
| Broad mail localization; signed-in password change | Separate NIMBUS-162 / NIMBUS-134 |

Plan approved by Klaus Petersen on 2026-10-23; tracker children created. Middleware registration order is verified by samples/verify-reset-order.cjs. Separate dispatcher handoff instruction is still pending; no implementation started.
