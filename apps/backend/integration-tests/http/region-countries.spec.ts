import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { createRegionsWorkflow } from "@medusajs/medusa/core-flows";

import addMissingRegionCountries from "../../src/migration-scripts/add-missing-region-countries";

jest.setTimeout(300 * 1000);

// The 7 countries a pre-NIMBUS-164 seed would have created (matches the
// pre-existing `initial-data-seed.ts` country list, before `no`/`pl` were added).
const PRE_EXISTING_COUNTRIES = ["gb", "de", "dk", "se", "fr", "es", "it"];

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "supersecret",
  },
  testSuite: ({ getContainer }) => {
    describe("add-missing-region-countries", () => {
      beforeEach(async () => {
        const container = getContainer();
        const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

        // Simulate a pre-NIMBUS-164 seed: an "Europe" region and fulfillment
        // set that don't yet include `no`/`pl`.
        await createRegionsWorkflow(container).run({
          input: {
            regions: [
              {
                name: "Europe",
                currency_code: "eur",
                countries: PRE_EXISTING_COUNTRIES,
                payment_providers: ["pp_system_default"],
              },
            ],
          },
        });

        await fulfillmentModuleService.createFulfillmentSets({
          name: "European Warehouse delivery",
          type: "shipping",
          service_zones: [
            {
              name: "Europe",
              geo_zones: PRE_EXISTING_COUNTRIES.map((country_code) => ({
                country_code,
                type: "country" as const,
              })),
            },
          ],
        });
      });

      // TC-3: One-off script adds countries to an existing region
      it("adds no/pl to the region, tax regions, and fulfillment geo-zones without disturbing existing data", async () => {
        const container = getContainer();
        const regionModuleService = container.resolve(Modules.REGION);
        const taxModuleService = container.resolve(Modules.TAX);
        const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

        await addMissingRegionCountries({ container });

        const [region] = await regionModuleService.listRegions(
          { name: "Europe" },
          { relations: ["countries"] }
        );
        expect(region.countries.map((c) => c.iso_2).sort()).toEqual(
          [...PRE_EXISTING_COUNTRIES, "no", "pl"].sort()
        );

        const taxRegions = await taxModuleService.listTaxRegions({
          country_code: ["no", "pl"],
        });
        expect(taxRegions.map((tr) => tr.country_code).sort()).toEqual([
          "no",
          "pl",
        ]);

        const [fulfillmentSet] = await fulfillmentModuleService.listFulfillmentSets(
          { name: ["European Warehouse delivery"] },
          { relations: ["service_zones", "service_zones.geo_zones"] }
        );
        const geoZoneCountries = (fulfillmentSet.service_zones[0].geo_zones ?? [])
          .map((gz) => gz.country_code)
          .sort();
        expect(geoZoneCountries).toEqual(
          [...PRE_EXISTING_COUNTRIES, "no", "pl"].sort()
        );
      });

      // TC-2: One-off script is idempotent
      it("makes no further changes when run a second time", async () => {
        const container = getContainer();
        const regionModuleService = container.resolve(Modules.REGION);

        await addMissingRegionCountries({ container });
        await expect(
          addMissingRegionCountries({ container })
        ).resolves.not.toThrow();

        const [region] = await regionModuleService.listRegions(
          { name: "Europe" },
          { relations: ["countries"] }
        );
        expect(region.countries.map((c) => c.iso_2).sort()).toEqual(
          [...PRE_EXISTING_COUNTRIES, "no", "pl"].sort()
        );
      });
    });
  },
});
