import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ApprovalType, type ModuleUpdateApproval } from '../../../types';

export const validateCompanyApprovalStep = createStep(
  'validate-company-approval',
  async (input: ModuleUpdateApproval, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: [approval] } = await query.graph({
      entity: 'approval',
      fields: ['id', 'type', 'cart.company.id'],
      filters: { id: input.id },
    }, { throwIfKeyNotFound: true });
    const { data: [customer] } = await query.graph({
      entity: 'customer',
      fields: ['employee.company_id', 'employee.is_admin'],
      filters: { id: input.handled_by },
    });
    const employee = customer?.employee;
    if (approval.type !== ApprovalType.ADMIN || !employee?.is_admin ||
      !approval.cart?.company?.id || employee.company_id !== approval.cart.company.id) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, 'Forbidden');
    }
    return new StepResponse(input);
  },
);
