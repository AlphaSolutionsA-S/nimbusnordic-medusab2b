import { sendNotificationsStep } from "@medusajs/medusa/core-flows";
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";

import { listConfiguredCountryCodesStep } from "../../storefront-translation/steps/list-configured-country-codes";
import { localizeEmailStep } from "../../transactional-email/steps/localize-email";
import { reportEmailFallbacksStep } from "../../transactional-email/steps/report-email-fallbacks";
import { prepareEmployeeInvitationNotificationStep } from "../steps/prepare-employee-invitation-notification";
import { readInvitationRecipientStep } from "../steps/read-invitation-recipient";
import type { EmployeeInvitedEventData } from "./create-employee-account";

export const sendEmployeeInvitationWorkflow = createWorkflow(
  "send-employee-invitation",
  (input: EmployeeInvitedEventData) => {
    const recipient = readInvitationRecipientStep(input);
    const configuredCountries = listConfiguredCountryCodesStep();
    const localization = localizeEmailStep(
      transform({ input, recipient, configuredCountries }, ({ input, recipient, configuredCountries }) => ({
        requestCountry: input.country_code,
        companyCountry: recipient.company_country,
        configuredCountries,
      }))
    );
    const prepared = prepareEmployeeInvitationNotificationStep({ recipient, localization });
    const sent = sendNotificationsStep(transform({ prepared }, ({ prepared }) => [prepared.notification]));
    reportEmailFallbacksStep(transform({ prepared }, ({ prepared }) => prepared.fallbacks));
    return new WorkflowResponse(sent);
  }
);
