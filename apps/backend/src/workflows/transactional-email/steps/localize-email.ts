import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import { DEFAULT_COUNTRY_LOCALE } from "../../../modules/storefront-translation/country-languages";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type { MessageDocument } from "../../../types/storefront-translation";
import { chooseEmailLanguage, type EmailLanguage } from "../utils/email-language";

export interface LocalizeEmailStepInput {
  requestCountry?: unknown;
  companyCountry?: string | null;
  configuredCountries: string[];
}

export interface EmailLocalization extends EmailLanguage {
  /** Active document of the chosen language; null when that language is not active. */
  chosen: MessageDocument | null;
  /** Active English document; null when English is not active. */
  english: MessageDocument | null;
}

/**
 * Reads the stored assignments rather than the published country languages: publication fails
 * closed when any assigned language is inactive, which would stop every email (NIMBUS-162).
 */
export const localizeEmailStep = createStep(
  "localize-email",
  async (input: LocalizeEmailStepInput, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(
      STOREFRONT_TRANSLATION_MODULE
    );
    const configuration = await service.getCountryLanguageConfiguration();
    const language = chooseEmailLanguage({
      ...input,
      assignments: configuration?.assignments ?? null,
    });
    const rows = await service.listStorefrontTranslations(
      { locale: [...new Set([language.locale, DEFAULT_COUNTRY_LOCALE])], is_active: true },
      { select: ["locale", "messages"] }
    );
    const documentFor = (locale: string): MessageDocument | null => {
      const row = rows.find((candidate) => candidate.locale === locale);
      return row ? (row.messages as MessageDocument) : null;
    };
    return new StepResponse<EmailLocalization>({
      ...language,
      chosen: documentFor(language.locale),
      english: documentFor(DEFAULT_COUNTRY_LOCALE),
    });
  }
);
