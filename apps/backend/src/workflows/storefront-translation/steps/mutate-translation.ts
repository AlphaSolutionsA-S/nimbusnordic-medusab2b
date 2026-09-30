import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { MutationInput } from "../../../types/storefront-translation";

// Single atomic compare-and-swap; no compensation, so a rollback can never overwrite a later version.
export const mutateTranslationStep = createStep(
  "mutate-translation",
  async (input: MutationInput, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    return new StepResponse(await service.mutateDocument(input));
  }
);
