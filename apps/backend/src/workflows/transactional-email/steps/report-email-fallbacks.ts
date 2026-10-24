import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { MissingReport } from "../../../types/storefront-translation";

/** Runs after the email is sent; a failed report is logged and never fails the email (NIMBUS-162). */
export const reportEmailFallbacksStep = createStep(
  "report-email-fallbacks",
  async (input: MissingReport[], { container }) => {
    if (!input.length) {
      return new StepResponse({ reported: false });
    }
    try {
      const service = container.resolve<StorefrontTranslationModuleService>(
        STOREFRONT_TRANSLATION_MODULE
      );
      await service.reportMissing(input);
      return new StepResponse({ reported: true });
    } catch (error) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `Email text fallbacks could not be reported: ${error instanceof Error ? error.message : "unknown error"}`
      );
      return new StepResponse({ reported: false });
    }
  }
);
