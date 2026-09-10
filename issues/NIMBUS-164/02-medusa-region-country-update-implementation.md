# Task 02: Add Missing Medusa Regions/Countries (NO, PL) — Implementation Plan

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-08-31
**Branch:** feature/NIMBUS-164 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build` (from repo root) or `cd apps/backend && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/backend && pnpm test:integration:modules` (closest existing suite for
  workflow-level checks; there is no dedicated region test file today)
- **Test framework:** Jest (node, @swc/jest)
- **Test location:** `apps/backend/src/modules/<name>/__tests__/` convention — since this task
  touches no custom module, tests are added as a standalone integration test under
  `apps/backend/integration-tests/http/region-countries.spec.ts` (see Impacted Files)
- **Naming conventions:** PascalCase types, camelCase functions/vars (per `apps/backend/copilot-instructions.md`)

## Solution Design

**Current state (confirmed by exploration):** `apps/backend/src/migration-scripts/initial-data-seed.ts`
hardcodes the target countries in **three separate places**:
1. `const countries = ["gb", "de", "dk", "se", "fr", "es", "it"]` (line 36) — used for the
   `"Europe"` region and tax regions.
2. `service_zones[0].geo_zones` (lines 169–198) — a separately hardcoded array of the same 7
   country codes, used for the fulfillment set.

Of the 8 target locales (DK, GB, SE, NO, PL, IT, FR, DE), **NO and PL are missing** from all three
places. **ES is present but not a target locale** — out of scope to remove (not requested; flagging
per agent-discipline, see Risks).

Two consumers of this data must both be updated:

1. **Fresh/local environments** (seed not yet run) — update `initial-data-seed.ts` so a new seed
   run creates the region/tax-region/fulfillment zone correctly with all 8 target countries plus
   the pre-existing `es`.
2. **Already-seeded environments** (region "Europe" already exists) — the seed script won't
   re-run. Add a new idempotent one-off script, following the same `migration-scripts/` convention
   and invocation style (`npx medusa exec ./src/migration-scripts/<file>.ts`) as the existing seed
   script, that:
   - Finds the existing region by name (`"Europe"`) via `regionModuleService.listRegions()`.
   - Calls `updateRegionsWorkflow` with `update.countries` set to the **union** of the region's
     current countries and `["no", "pl"]` (this workflow replaces the full list, so the existing
     list must be read first and merged, not overwritten).
   - Calls `createTaxRegionsWorkflow` for `no` and `pl` only (skip countries that already have a
     tax region, to keep the script idempotent/re-runnable).
   - Adds `no`/`pl` geo-zones to the existing fulfillment set's service zone via
     `fulfillmentModuleService.updateServiceZones` (append-only, keep existing geo-zones).

## Code Skeletons

### New File: `apps/backend/src/migration-scripts/add-missing-region-countries.ts`

```typescript
import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createTaxRegionsWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows";

const NEW_COUNTRIES = ["no", "pl"];
const TARGET_REGION_NAME = "Europe";

export default async function add_missing_region_countries({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const regionModuleService = container.resolve(Modules.REGION);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const taxModuleService = container.resolve(Modules.TAX);

  const [region] = await regionModuleService.listRegions({
    name: [TARGET_REGION_NAME],
  });

  if (!region) {
    logger.warn(
      `No region named "${TARGET_REGION_NAME}" found — nothing to update. Run the initial seed first.`
    );
    return;
  }

  const existingCountryCodes = (region.countries ?? []).map(
    (c) => c.iso_2 ?? ""
  );
  const missingCountries = NEW_COUNTRIES.filter(
    (code) => !existingCountryCodes.includes(code)
  );

  if (missingCountries.length) {
    logger.info(
      `Adding countries to region "${TARGET_REGION_NAME}": ${missingCountries.join(", ")}`
    );
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: {
          countries: [...existingCountryCodes, ...missingCountries],
        },
      },
    });
  } else {
    logger.info("Region already contains all target countries. Skipping region update.");
  }

  const existingTaxRegions = await taxModuleService.listTaxRegions({
    country_code: NEW_COUNTRIES,
  });
  const existingTaxCountryCodes = existingTaxRegions.map((tr) => tr.country_code);
  const missingTaxCountries = NEW_COUNTRIES.filter(
    (code) => !existingTaxCountryCodes.includes(code)
  );

  if (missingTaxCountries.length) {
    logger.info(`Creating tax regions for: ${missingTaxCountries.join(", ")}`);
    await createTaxRegionsWorkflow(container).run({
      input: missingTaxCountries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    });
  } else {
    logger.info("Tax regions already exist for all target countries. Skipping.");
  }

  const [fulfillmentSet] = await fulfillmentModuleService.listFulfillmentSets({
    name: ["European Warehouse delivery"],
  });

  if (!fulfillmentSet) {
    logger.warn(
      'No fulfillment set named "European Warehouse delivery" found — skipping geo-zone update.'
    );
    return;
  }

  const serviceZone = fulfillmentSet.service_zones?.[0];
  const existingGeoZoneCountryCodes = (serviceZone?.geo_zones ?? [])
    .filter((gz) => gz.type === "country")
    .map((gz) => gz.country_code);
  const missingGeoZoneCountries = NEW_COUNTRIES.filter(
    (code) => !existingGeoZoneCountryCodes.includes(code)
  );

  if (missingGeoZoneCountries.length && serviceZone) {
    logger.info(
      `Adding geo-zones for: ${missingGeoZoneCountries.join(", ")}`
    );
    await fulfillmentModuleService.updateServiceZones({
      id: serviceZone.id,
      geo_zones: [
        ...(serviceZone.geo_zones ?? []),
        ...missingGeoZoneCountries.map((country_code) => ({
          country_code,
          type: "country" as const,
        })),
      ],
    });
  } else {
    logger.info("Fulfillment geo-zones already cover all target countries. Skipping.");
  }

  logger.info("Finished adding missing region countries.");
}
```

> **Note for the worker:** verify the exact method names `listRegions`, `listTaxRegions`,
> `listFulfillmentSets`, and `updateServiceZones` against the installed `@medusajs/medusa` /
> `@medusajs/framework` version in `apps/backend/node_modules` before finalizing — Medusa v2
> module service method names have shifted between minor versions. If a method name differs,
> use the equivalent method exposed by that module's service and keep the same idempotent
> read-then-merge logic.

## Impacted Files

- `apps/backend/src/migration-scripts/initial-data-seed.ts`:
  - Line 36: change `const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];` to
    `const countries = ["gb", "de", "dk", "se", "fr", "es", "it", "no", "pl"];`
  - Lines 169–198 (`service_zones[0].geo_zones`): add two more entries,
    `{ country_code: "no", type: "country" }` and `{ country_code: "pl", type: "country" }`,
    matching the existing entry shape exactly.
- New: `apps/backend/src/migration-scripts/add-missing-region-countries.ts` (for already-seeded
  environments).
- New: `apps/backend/integration-tests/http/region-countries.spec.ts` (see Test Cases).

## Test Cases

### TC-1: Fresh seed includes all 8 target countries
- **Given:** a clean database
- **When:** `initial-data-seed.ts` is run via `npx medusa exec ./src/migration-scripts/initial-data-seed.ts`
- **Then:** `GET /store/regions` returns a region whose `countries` include `no` and `pl` in
  addition to the existing `gb, de, dk, se, fr, es, it`

### TC-2: One-off script is idempotent
- **Given:** a database where `add-missing-region-countries.ts` has already been run once
- **When:** it is run a second time
- **Then:** it logs "Skipping" for each already-satisfied step and makes no further API calls that
  would error or duplicate data

### TC-3: One-off script adds countries to an existing region
- **Given:** a database seeded via the original (pre-NIMBUS-164) `initial-data-seed.ts`, i.e. a
  region `"Europe"` without `no`/`pl`
- **When:** `add-missing-region-countries.ts` is run
- **Then:** `GET /store/regions` shows the `"Europe"` region's `countries` now includes `no` and
  `pl`, and the pre-existing 7 countries are unchanged

## Implementation Steps

1. Update `initial-data-seed.ts` lines 36 and the `geo_zones` array as specified above.
2. Add the new `add-missing-region-countries.ts` script, verifying module service method names
   against the installed Medusa version first (see the note in Code Skeletons).
3. Add the integration test file covering TC-1–TC-3 (or document manual verification steps if the
   integration test harness cannot easily provision a pre-existing "old" seed state — in that case
   mark TC-2/TC-3 `⚠️ MANUAL TESTING REQUIRED` and note why in the task's final report).
4. Run `pnpm build` and `pnpm lint` from repo root.
5. Document in the PR description that `add-missing-region-countries.ts` must be run once against
   any already-seeded environment (staging/production) after this change is deployed — this is a
   manual operational step, not something CI/CD can trigger automatically.

## Risks

- **ES is seeded but not a target locale.** Out of scope to remove per this story's requirements
  (only "add any that are missing" was requested) — flagging for the user's attention, not fixing
  silently.
- Module service method names (`listFulfillmentSets`, `updateServiceZones`, etc.) must be verified
  against the exact installed `@medusajs/medusa` version — Medusa v2's module service APIs have
  changed across minor versions, and using a wrong method name will fail at runtime, not compile
  time (module services are loosely typed via DI resolution).
