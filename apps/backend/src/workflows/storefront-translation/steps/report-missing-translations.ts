import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { MissingReport } from "../../../types/storefront-translation";

export const reportMissingTranslationsStep = createStep(
  "report-missing-translations",
  async (input: MissingReport[], { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    return new StepResponse(await service.reportMissing(input));
  }
);
