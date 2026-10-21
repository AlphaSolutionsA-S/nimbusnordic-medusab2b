import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";

export const publishCountryLanguagesStep = createStep(
  "publish-country-languages",
  async (configuredCountryCodes: string[], { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    return new StepResponse(await service.publishCountryLanguages(configuredCountryCodes));
  }
);
