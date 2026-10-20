import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { CountryLanguageAssignments } from "../../../types/storefront-translation";

export const previewCountryLanguageBootstrapStep = createStep(
  "preview-country-language-bootstrap",
  async (assignments: CountryLanguageAssignments, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    return new StepResponse(await service.previewCountryLanguageBootstrap(assignments));
  }
);
