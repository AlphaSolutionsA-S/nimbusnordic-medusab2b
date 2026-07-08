---
applyTo: "apps/backend/**"
---

# Medusa Commerce Backend

## Overview

Medusa v2 headless commerce engine. Provides the commerce API consumed by the storefront.

## Project Structure

```
src/
  admin/           # Admin dashboard customizations (Vite + React)
  api/             # Custom API routes
    admin/         # Admin-only endpoints
    store/         # Storefront-facing endpoints
  jobs/            # Scheduled/background jobs
  links/           # Module link definitions
  migration-scripts/  # Database seed and migration scripts
  modules/         # Custom Medusa modules
  subscribers/     # Event subscribers
  workflows/       # Medusa workflow definitions
```

## Configuration

- `medusa-config.ts` — Medusa project config (database, CORS, secrets)
- Database: **PostgreSQL** (connection via `DATABASE_URL` env var)
- CORS: configured per environment (`STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`)

## Medusa Knowledge

Use the **Medusa MCP server** and **Medusa agent skills** for Medusa v2 patterns, module creation, workflow design, and API route conventions. Do not reinvent Medusa patterns — defer to the official documentation.

- MCP server: `https://docs.medusajs.com/mcp`
- Agent skills: `medusajs/medusa-agent-skills` (building-with-medusa, db-generate, db-migrate)

## Commands

| Command | Description |
|---------|-------------|
| `pnpm backend:dev` | Start backend dev server (from root) |

Backend runs at `http://localhost:9000`. Admin dashboard at `http://localhost:9000/app`.

## Connection to Storefront

The storefront consumes this backend via the Medusa JS SDK (`@medusajs/js-sdk`). The SDK is configured in `apps/storefront/src/lib/config.ts`. Storefront data fetching functions live in `apps/storefront/src/lib/data/`.

## Naming Conventions

- **Directories:** kebab-case
- **Files:** kebab-case for modules/services, PascalCase for React admin components
- **Variables/functions:** camelCase
- **Types/interfaces:** PascalCase
