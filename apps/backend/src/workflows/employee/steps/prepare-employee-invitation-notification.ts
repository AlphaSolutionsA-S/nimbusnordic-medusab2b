import type { ConfigModule } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import {
  buildEmployeeInvitationNotification,
  type EmployeeInvitationLocalization,
  type InvitationRecipient,
} from "../utils/employee-invitation-notification";

export type PrepareEmployeeInvitationNotificationInput = {
  recipient: InvitationRecipient;
  localization: EmployeeInvitationLocalization;
};

export const prepareEmployeeInvitationNotificationStep = createStep(
  "prepare-employee-invitation-notification",
  async ({ recipient, localization }: PrepareEmployeeInvitationNotificationInput, { container }) => {
    const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    return new StepResponse(
      buildEmployeeInvitationNotification(recipient, config.projectConfig.http.storeCors, localization)
    );
  }
);
