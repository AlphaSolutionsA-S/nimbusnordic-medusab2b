import type { ConfigModule } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import {
  buildPasswordResetNotification,
  type PasswordResetEvent,
  type PasswordResetLocalization,
} from '../utils/password-reset-notification';

export type PreparePasswordResetNotificationInput = {
  event: PasswordResetEvent;
  localization: PasswordResetLocalization;
};

export const preparePasswordResetNotificationStep = createStep(
  'prepare-password-reset-notification',
  async ({ event, localization }: PreparePasswordResetNotificationInput, { container }) => {
    const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    return new StepResponse(buildPasswordResetNotification(event, config.projectConfig.http.storeCors, localization));
  },
);
