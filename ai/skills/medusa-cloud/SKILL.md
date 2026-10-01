---
name: medusa-cloud
description: "Medusa Cloud (hosting for Medusa v2, Node/TypeScript) via the mcloud CLI: setup and auth, deployments, build and runtime logs, environments, environment variables and CI/CD. Load before running any mcloud command or debugging a Medusa Cloud deployment."
---

# Managing Medusa Cloud Resources

Load a reference before any multi-step workflow:

| Task | Reference |
|------|-----------|
| Installing the CLI, auth, context | `reference/setup.md` |
| Build/deployment failures, log analysis | `reference/debugging-deployments.md` |
| Environment lifecycle, variables | `reference/environments-and-variables.md` |

## Constraints

- Pass `--json` whenever you parse output. Plaintext is for humans and may change without warning.
- Confirm context before any state change: `mcloud whoami --json`.
- Read before you write: run a `get` or `list` before any `delete`, `redeploy` or `trigger-build`.
- `delete` commands need `--yes` in non-interactive mode.
- Production environments cannot be deleted; `mcloud environments delete` errors on them by design.
- Pass `--reveal` only when the user explicitly asks. Secret values end up in terminal scrollback and logs.
- `--json` and `--follow` are incompatible. For programmatic log ingestion use `--json` with a bounded window (`--from`/`--to`).

## Quick Reference

Auth and scope check (exit `0` = authenticated and scoped; non-zero = stop and ask the user):

```bash
mcloud whoami --json | jq -e '.auth.kind != "none" and .organization.id != null'
```

Set context once. Always pass flags: `mcloud use` without them is interactive and fails in CI/Docker/piped input.

```bash
mcloud use --organization org_123 --project proj_123 --environment production
```

Route on `backend_status` (or `storefront_status`):

| Status | Meaning | Logs |
|--------|---------|------|
| `build-failed` | Build step failed | `mcloud deployments build-logs <id>` |
| `deployment-failed` | Runtime crashed after build | `mcloud logs --deployment <id>` |
| `timed-out` | Exceeded time budget | Both: build-logs first, then runtime logs |

Rerun:

| Command | When |
|---------|------|
| `mcloud environments redeploy <env>` | Fix is environment-side (variable change, infra); reruns the existing build |
| `mcloud environments trigger-build <env>` | Fix is in source on the tracked branch; starts a new build |

## Pitfalls

- TTY-only: `mcloud login`, `mcloud use` without flags, and `delete` without `--yes` fail in CI, Docker or piped input.
- When `MCLOUD_TOKEN` is set, file-based credentials are ignored and `mcloud login` is rejected. Unset it to switch accounts.
- Personal access keys need `--organization`; org keys are pre-scoped.
- `organizations list` needs personal auth; org access keys get 401.
- `depl_*` is a deployment ID; anything else is a build ID (resolved to its latest deployment). `mcloud logs --deployment` accepts both; other commands take build IDs only.

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
