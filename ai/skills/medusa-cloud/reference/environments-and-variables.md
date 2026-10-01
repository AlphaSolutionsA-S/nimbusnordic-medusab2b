# Environments and Variables

## Environments

```bash
mcloud environments create --name "Staging" --branch develop                       # preview env
mcloud environments get staging --json | jq '{id, name, type, status, external_id}'
mcloud environments delete env_123 --yes
```

Production environments are protected: `delete` returns a non-zero exit code. In automation, check `type` via `environments get --json` before deleting.

## Variables

Variables are scoped to a single environment.

```bash
mcloud variables list --json
mcloud variables get DATABASE_URL --json   # by key: needs active project and environment
mcloud variables get var_01XYZ --json      # by ID: works without project/environment context
```

Pass `--reveal` only when the user explicitly asks: plaintext values appear in terminal scrollback, log aggregators and process listings.

```bash
mcloud variables get STRIPE_SECRET_KEY --reveal --json | jq -r '.value'

# Export a Cloud environment's variables to a local .env
mcloud variables list --reveal --json | jq -r '.[] | "\(.key)=\(.value)"' > .env
```
