import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import type { ModuleCreateQuoteMessage } from '../../../types';

export const validateQuoteMessageAccessStep = createStep(
  'validate-quote-message-access',
  async (input: ModuleCreateQuoteMessage, { container }) => {
    if (input.customer_id) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY);
      await query.graph({
        entity: 'quote',
        fields: ['id'],
        filters: { id: input.quote_id, customer_id: input.customer_id },
      }, { throwIfKeyNotFound: true });
    }
    return new StepResponse(input);
  },
);
