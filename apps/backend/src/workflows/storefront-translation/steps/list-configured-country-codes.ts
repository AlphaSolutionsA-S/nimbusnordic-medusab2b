import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { configuredCountryCodes } from "../utils/country-language-scope";

export const listConfiguredCountryCodesStep = createStep(
  "list-configured-country-codes",
  async (_input: void, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    // Deliberate exemption from data-core-read-workflows: a narrow Region membership read, no
    // region details.
    const { data } = await query.graph({ entity: "region", fields: ["id", "countries.iso_2"] });
    return new StepResponse(configuredCountryCodes(data));
  }
);
