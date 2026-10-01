# Debugging Deployments

Each deployment has `backend_status` and `storefront_status`. Values: `created`, `building`, `built`, `deploying`, `deployed`, `build-failed`, `deployment-failed`, `timed-out` (backend only), `canceled`, `idle`.

## Inspecting

```bash
# Most recent failed deployment
mcloud deployments list --json \
  | jq -r '[.[] | select(.backend_status == "build-failed" or .backend_status == "deployment-failed")][0].id'
mcloud deployments list --commit a1b2c3d --json | jq '.'              # for a commit
mcloud deployments list --environment-type preview --json | jq '.'    # previews only
mcloud deployments get bld_01ABC123 --json                             # one deployment
```

## Build failure (`backend_status == "build-failed"`)

```bash
DEPLOYMENT_ID=$(mcloud deployments list --json \
  | jq -r '[.[] | select(.backend_status == "build-failed")][0].id')
mcloud deployments get "$DEPLOYMENT_ID" --json
mcloud deployments build-logs "$DEPLOYMENT_ID"
mcloud deployments build-logs "$DEPLOYMENT_ID" --type storefront   # storefront builds
```

`build-logs` returns `build_status`. When it is `failed`, read `metadata.failed_docker_layer` from `mcloud deployments get --json` to find the failing layer.

## Deployment failure (`backend_status == "deployment-failed"`: build succeeded, runtime crashed)

```bash
DEPLOYMENT_ID=$(mcloud deployments list --json \
  | jq -r '[.[] | select(.backend_status == "deployment-failed")][0].id')
mcloud logs --deployment "$DEPLOYMENT_ID" --limit 1000
mcloud logs --deployment "$DEPLOYMENT_ID" --search error --limit 1000        # error lines
mcloud logs --deployment "$DEPLOYMENT_ID" --metadata status=500 --limit 1000 # by HTTP status
mcloud logs --deployment "$DEPLOYMENT_ID" --json | jq '.[] | {timestamp, source, message}'
```

`--follow` cannot be combined with `--json`; scripts use `--json` with `--from`/`--to`.

## Rerunning (the two are not interchangeable)

- `mcloud environments redeploy env_123` — reruns the active deployment's existing build. For variable or infra fixes. Needs an active deployment; if there is none, use `trigger-build` first.
- `mcloud environments trigger-build env_123` — new build from the tracked branch. For fixes in committed code.

Verify the new build:

```bash
mcloud deployments list --environment env_123 --limit 5 --json \
  | jq '.[] | {id, backend_status, commit_hash, updated_at}'
```
