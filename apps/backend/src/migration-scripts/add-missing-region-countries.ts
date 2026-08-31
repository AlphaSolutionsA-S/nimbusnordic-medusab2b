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

  const [region] = await regionModuleService.listRegions(
    { name: TARGET_REGION_NAME },
    { relations: ["countries"] }
  );

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

  const [fulfillmentSet] = await fulfillmentModuleService.listFulfillmentSets(
    { name: ["European Warehouse delivery"] },
    { relations: ["service_zones", "service_zones.geo_zones"] }
  );

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
    await fulfillmentModuleService.updateServiceZones(serviceZone.id, {
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
