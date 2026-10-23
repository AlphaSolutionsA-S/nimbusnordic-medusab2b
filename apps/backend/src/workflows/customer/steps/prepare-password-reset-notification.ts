import type { ConfigModule } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { buildPasswordResetNotification, type PasswordResetEvent } from '../utils/password-reset-notification';

export const preparePasswordResetNotificationStep = createStep(
  'prepare-password-reset-notification',
  async (input: PasswordResetEvent, { container }) => {
    const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
    return new StepResponse([buildPasswordResetNotification(input, config.projectConfig.http.storeCors)]);
  },
);
