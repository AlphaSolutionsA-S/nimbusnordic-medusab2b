# Medusa boundary: detail and examples

The rules are in the project's Tier 0 `medusa-boundary.md` (starter: this skill's
`tier0/medusa-boundary.md`); this file holds only the detail and code behind them. The rule IDs are
defined in the Quick Reference of `SKILL.md`; query mechanics are in
[querying-data.md](querying-data.md).

## Verify, don't assume

Installed source under pnpm: file reads of `<backend>/node_modules/@medusajs/<pkg>/dist/...` follow
the symlinks but `grep -r` does not, so grep the root store
`node_modules/.pnpm/@medusajs+<pkg>@*/node_modules/@medusajs/<pkg>`. `<app>/node_modules/.pnpm`
does not exist in a workspace, and non-direct dependencies have no top-level entry. Under npm or
yarn, grep `node_modules/@medusajs/<pkg>/dist`.

## OOTB first

`createSalesChannelsWorkflow` emits `sales-channel.created` and `updateSalesChannelsWorkflow` emits
`sales-channel.updated`; `salesChannelService.createSalesChannels` emits neither, so a subscriber on
those events silently never runs.

## Reading core data

Full diagnosis table for `data-schema-vs-model`:
[querying-data.md](querying-data.md#the-category-behind-it-computed-fields-and-where-they-are-computed).

## Types

- `type-container-resolve`: annotate the variable; the `as` form works but is not the Medusa
  pattern, and the untyped form is TS18046 (`'service' is of type 'unknown'`).

  ```typescript
  const myService: MyModuleService = container.resolve(MY_MODULE)       // ✓ matches the official docs
  // ✗ container.resolve(MY_MODULE) as MyModuleService
  // ✗ container.resolve(MY_MODULE)                                        — TS18046
  ```

  Common annotations (types from `@medusajs/framework/types` unless noted): `MyModuleService` ←
  `MY_MODULE`; `ISalesChannelModuleService` ← `Modules.SALES_CHANNEL`;
  `Omit<RemoteQueryFunction, symbol>` ← `ContainerRegistrationKeys.QUERY`; `Logger` ←
  `ContainerRegistrationKeys.LOGGER`; `Link` (`@medusajs/framework/modules-sdk`) ←
  `ContainerRegistrationKeys.LINK`.
- `type-metadata-optional`: every entity `metadata` field is optional; `channel.metadata.campaign_id`
  fails with TS18048 ("'metadata' is possibly 'undefined'"). Use `entity.metadata?.key`,
  `entity.metadata?.nested?.property`, `entity.metadata?.key ?? defaultValue`,
  `entities.filter((e): e is Entity => e.metadata?.key === value)`, and handle the missing case
  explicitly (e.g. return `new StepResponse({ skipped: true })`).

## Module-service constraints

`data-service-transaction` example: [custom-modules.md](custom-modules.md#2-service).
