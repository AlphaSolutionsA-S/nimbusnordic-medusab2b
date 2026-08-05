import { IAuthModuleService } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

export const getCustomerAuthIdentityStep = createStep(
  'get-customer-auth-identity',
  async (email: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [providerIdentity],
    } = await query.graph({
      entity: 'provider_identity',
      fields: ['auth_identity.id'],
      filters: {
        provider: 'emailpass',
        entity_id: email,
      },
    });

    return new StepResponse(providerIdentity?.auth_identity?.id);
  }
);

export const deleteAuthIdentityStep = createStep(
  'delete-auth-identity',
  async (authIdentityId: string | undefined, { container }) => {
    if (!authIdentityId) {
      return new StepResponse();
    }

    const authModuleService = container.resolve<IAuthModuleService>(
      Modules.AUTH
    );

    await authModuleService.deleteAuthIdentities([authIdentityId]);

    return new StepResponse();
  }
);