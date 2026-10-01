---
name: medusa-infra-adapter
description: "Medusa v2 (Node/TypeScript) backend layer skill for L2: the clients and providers that wrap exactly one external system (vendor HTTP clients inside a module, clients in src/lib/, and Payment or Notification providers registered with ModuleProvider). Load before writing or changing backend code that calls a vendor API."
---

# Infra adapter (L2)

The layer ids come from the Medusa Tier 0 starter shipped with the `medusa-backend` skill. Paths are
relative to the backend's `src/`; written against Medusa 2.17.

Layer row: [layers.md](../../architecture/layers.md) (L2). Vendor claims are verified per
[medusa-boundary.md](../../architecture/medusa-boundary.md) ("Verify, don't assume"). Vendor detail:
the vendor's own skill where the project has one; Medusa provider guides via the `medusa` MCP
(`get_payment_provider_integration_guide`, `get_fulfillment_provider_integration_guide`).

## Responsibility

An adapter speaks to exactly one external system: it builds the request, authenticates, applies
transport concerns (timeout, retry, envelope check) and returns typed data or throws. It holds no
domain rule; deciding what to send, to whom, and what a response means for an order or product
belongs to an L5 decision function or an L3 step. Adapters are called from L3 steps in one of two
ways:

- Through the owning module service, which builds the client lazily. A client that needs the
  module's own data (for example decrypted fields) is an internal service in
  `modules/<m>/services/`, injected into the main service. Medusa registers every exported function
  or class of each file there except `index.*` (`load-internal.js`, 2.17.2), so a service file
  exports only its class.
- As a Medusa provider (`ModuleProvider(Modules.PAYMENT | Modules.NOTIFICATION, …)`) that core
  steps reach; a notification provider's `service.ts` extends `AbstractNotificationProviderService`.

A good client: one vendor, the constructor validates its secrets, one public method per vendor
operation, retry with backoff, and a non-OK status or a non-`ok` response envelope becomes an error.

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-module-isolation` | a client inside `modules/<m>/` imports nothing from another module |
| `bound-module-no-upward` | no import from `workflows/`, `api/`, `subscribers/`, `jobs/`, `links/` |
| `bound-lib-leaf` | a client in `lib/` imports nothing from `modules/`, `workflows/`, `api/`, `subscribers/`, `jobs/` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the storefront) |

Beyond these, only the vendor's SDK or HTTP.

## Forbidden

- A domain rule in the adapter (layers.md L2; the rule's home is in `decisions.md`)
- `NO_MEDUSA_MODULE_IN_LIB`
- `NO_FIRE_AND_FORGET`, `NO_SET_IMMEDIATE`
- `NO_UNKNOWN_CAST`, `type-no-any` (derive the SDK's request type; a caught error is `unknown`)
- `type-container-resolve` (providers resolving from their container)
- An unverified security-relevant vendor claim (signature, replay, token check), per
  medusa-boundary.md

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden
- [ ] Vendor behaviour the design relies on verified (medusa-boundary.md)

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
