import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";

export const dismissMissingTranslationStep = createStep(
  "dismiss-missing-translation",
  async (input: { locale: string; id: string }, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    await service.dismissMissing(input.locale, input.id);
    return new StepResponse({ dismissed: true as const });
  }
);
