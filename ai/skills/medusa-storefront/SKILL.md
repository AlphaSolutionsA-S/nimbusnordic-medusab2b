---
name: medusa-storefront
description: "Medusa v2 (Node/TypeScript) storefront calling the backend through the Medusa JS SDK (@medusajs/js-sdk 2.x): SDK usage, custom API routes, price display, Next.js App Router reads and server actions, an optional React Query layer. Load before planning, researching or implementing storefront code that talks to a Medusa backend."
---

# Medusa storefront

Written against `@medusajs/js-sdk` 2.17.2 and Next.js 16 (App Router). The SDK rules (`sdk-*`, and
`data-price-format` for display) hold for any JavaScript frontend, the Medusa Admin included; the sections marked Next.js assume the App Router.

## Layer mapping

In a Next.js App Router storefront the Medusa data layer is storefront S0–S2 of the Medusa Tier 0
starter: the file that instantiates the SDK is S0, the Medusa → view-model mappers are S1, the
cached read functions and the `*-actions.ts` server actions are S2. Load `nextjs-data-layer` for the
boundary rule IDs; this skill keeps the Medusa SDK specifics. Business rules are rendered from
backend verdicts, never re-derived in the storefront (Tier 0 `decisions.md`, where the project has
one).

This skill covers the data layer (SDK usage, data fetching, server actions), not presentation.
Presentation components consume the data layer through server actions or props and never import
the server-side SDK instance directly. For the backend routes the storefront calls, load
`medusa-backend`.

## Next.js App Router pattern

- The SDK instance lives in a `server-only` module, next to a typed, read-only GET wrapper over
  `sdk.client.fetch` that sets a read timeout (`signal: AbortSignal.timeout(ms)`) and Next.js
  caching (`next: { revalidate, tags }`); the SDK forwards standard fetch init to `fetch`. The
  wrapper is never used for cart or checkout mutations, so it has no retry and no double-submit
  risk.
- Server Components read through cached functions in a `server-only` module built on that wrapper.
- Mutations and per-shopper reads are server actions (`"use server"`, `*-actions.ts`) calling
  `sdk.store.*` or `sdk.client.fetch`.
- With this pattern no client-side query library is needed. The `query-*` and `error-rollback`
  rules apply only once a client-side query layer (React Query) is added.

## Reference

Load `references/frontend-integration.md` before writing storefront integration code (calling API
routes, using the SDK); the quick reference below is not enough to implement from. It holds the
SDK call examples, the verified SDK request behaviour and, for a client-side layer, React Query
patterns, query keys, error handling and optimistic updates.

## Rule categories

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | SDK Usage | CRITICAL | `sdk-` |
| 2 | React Query Patterns | HIGH | `query-` |
| 3 | Error Handling | MEDIUM | `error-` |

## Quick Reference

### 1. SDK Usage (CRITICAL)

- `sdk-always-use` - Use the Medusa JS SDK for all API requests, never plain `fetch()`.
- `sdk-existing-methods` - For built-in endpoints use the existing SDK methods (`sdk.store.product.list()`, `sdk.admin.order.retrieve()`).
- `sdk-client-fetch` - For custom API routes use `sdk.client.fetch()`.
- `sdk-required-headers` - The SDK adds the required headers: `x-publishable-api-key` for store routes, `Authorization` and session headers for admin routes. Plain `fetch()` lacks them and gets authentication/authorization errors.
- `sdk-no-json-stringify` - Never `JSON.stringify()` the body; the SDK serializes it, and stringifying double-serializes so the server cannot parse it.
- `sdk-plain-objects` - Pass plain JavaScript objects as `body`, not strings. Don't set Content-Type manually; the SDK adds it.
- `sdk-locate-first` - Locate where the SDK is instantiated before using it; don't hardcode the import path or assume the instance is named `sdk` (`project.md` names it).

### 2. React Query Patterns (HIGH)

- `query-use-query` - `useQuery` for GET requests.
- `query-use-mutation` - `useMutation` for POST/DELETE requests.
- `query-invalidate` - Invalidate queries in `onSuccess` after mutations.
- `query-keys-hierarchical` - Structure query keys hierarchically.
- `query-loading-states` - Handle `isLoading`, `isPending`, `isError`; disable buttons while `isPending`.

### 3. Error Handling (MEDIUM)

- `error-on-error` - Implement `onError` in mutations.
- `error-display` - Show error messages to users when mutations fail, including network failures.
- `error-rollback` - Use optimistic updates with rollback on error.

### Prices (CRITICAL)

- `data-price-format` (defined in `medusa-backend`) - Medusa prices are as-is ($49.99 = 49.99, not cents): display them directly, never divide by 100.

## Helper function placement

1. Check what exists first: the mappers of the Medusa data layer, the view-model types the UI
   consumes, the backend-verdict readers (render those, per Layer mapping above), and the project's
   general helpers (`project.md` lists them).
2. If nothing fits:
   - Pure Medusa → view-model mapping goes in the Medusa mappers file; other commerce display
     helpers in their own file beside the other shared helpers.
   - General-purpose helpers go in the project's shared utils.
   - Logic tightly coupled to one component's data shape stays local to that component.
3. Prefer global placement for anything reusable (price formatting, strings, dates).

## Skill vs Medusa docs MCP

This skill is the primary source for calling custom routes, `sdk.client.fetch` usage, React Query
patterns and anti-patterns such as `JSON.stringify` on the body, which the MCP does not emphasize.
Use the Medusa docs MCP server as the secondary source for built-in SDK methods (`sdk.admin.*`,
`sdk.store.*`), the official SDK API reference and framework configuration.
The `medusa` MCP is only available to Medusa Cloud users; where the project has none, "the `medusa` MCP" in
this skill means the documentation at `https://docs.medusajs.com` and the installed source.

## Spanning backend and frontend

1. Backend (`medusa-backend`): Module → Workflow → API Route.
2. Storefront (this skill): SDK → Server Component read or server action → UI components, calling
   built-in endpoints via SDK methods and custom routes via `sdk.client.fetch("/store/my-route")`.

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
