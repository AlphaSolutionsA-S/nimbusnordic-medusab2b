# CLI Setup and Authentication

One-time setup. Skip steps whose checks already pass.

1. `mcloud --version` — if it exits `0` with a version, skip to step 4.
2. `node --version` — the CLI needs Node.js v22+. If lower, ask the user to upgrade (nvm or the official installer); do not upgrade without authorization.
3. Install globally with the project's package manager, then re-check `mcloud --version`. If not found, ask the user to check that the global bin directory is on `PATH` (pnpm: `pnpm bin -g`; `pnpm setup` adds it to the shell config).
   ```bash
   pnpm add -g @medusajs/mcloud   # or: npm install -g @medusajs/mcloud
   ```
4. Ask whether the user has a Medusa Cloud account.
   - Has one: `mcloud login` (opens a browser).
   - None: `mcloud signup`, then `mcloud login`.
   - Non-interactive (CI, Docker, headless): `export MCLOUD_TOKEN=<access-key>`. The CLI then uses it on every command and rejects `mcloud login`.
5. Verify: `mcloud whoami --json`, then the auth/scope check:
   ```bash
   mcloud whoami --json | jq -e '.auth.kind != "none" and .organization.id != null'
   ```

## Active context

`mcloud use` persists org, project and environment so later commands can omit `--organization`, `--project`, `--environment`. Clear it with `mcloud use --clear`.

```bash
mcloud use --organization org_123 --project proj_123 --environment production
```

If you only have names, resolve them to IDs/handles first:

```bash
ORGANIZATION_ID=$(mcloud organizations list --json \
  | jq -r '.[] | select(.name == "My Organization") | .id')
PROJECT_HANDLE=$(mcloud projects list --organization "$ORGANIZATION_ID" --json \
  | jq -r '.[] | select(.name == "My Store") | .handle')
ENVIRONMENT_HANDLE=$(mcloud environments list --organization "$ORGANIZATION_ID" --project "$PROJECT_HANDLE" --json \
  | jq -r '.[] | select(.name == "Production") | .handle')

mcloud use --organization "$ORGANIZATION_ID" --project "$PROJECT_HANDLE" --environment "$ENVIRONMENT_HANDLE"
```
