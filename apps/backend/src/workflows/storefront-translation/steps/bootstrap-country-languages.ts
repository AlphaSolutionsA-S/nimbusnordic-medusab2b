import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { CountryLanguageAssignments } from "../../../types/storefront-translation";

// Insert-if-absent; no compensation, because a later failure must not remove an initialized
// configuration that Admin users may already be editing.
export const bootstrapCountryLanguagesStep = createStep(
  "bootstrap-country-languages",
  async (assignments: CountryLanguageAssignments, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    return new StepResponse(await service.bootstrapCountryLanguages(assignments));
  }
);
