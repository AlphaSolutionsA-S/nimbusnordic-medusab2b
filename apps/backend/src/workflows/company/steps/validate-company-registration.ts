import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

export const validateCompanyRegistrationStep = createStep(
  'validate-company-registration',
  async (customerId: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: [customer] } = await query.graph({
      entity: 'customer',
      fields: ['id', 'employee.id'],
      filters: { id: customerId },
    }, { throwIfKeyNotFound: true });
    if (customer.employee) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, 'Customer already belongs to a company');
    }
    return new StepResponse(customer.id);
  },
);
