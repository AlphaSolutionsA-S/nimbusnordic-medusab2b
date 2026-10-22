import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ApprovalType, type ModuleUpdateApproval } from '../../../types';
import { hasVerifiedCartAssociation } from '../../cart/utils/cart-access';

export const validateCompanyApprovalStep = createStep(
  'validate-company-approval',
  async (input: ModuleUpdateApproval, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: [approval] } = await query.graph({
      entity: 'approval',
      fields: ['id', 'type', 'cart.customer_id', 'cart.company.id', 'cart.customer.employee.company_id'],
      filters: { id: input.id },
    }, { throwIfKeyNotFound: true });
    const { data: [customer] } = await query.graph({
      entity: 'customer',
      fields: ['employee.company_id', 'employee.is_admin'],
      filters: { id: input.handled_by },
    });
    const employee = customer?.employee;
    const cart = approval.cart;
    // An ambiguous cart (owner left, or link differs from the owner's company) is decidable by no
    // one, so its approval state stays untouched (NIMBUS-177).
    const verified = !!cart && hasVerifiedCartAssociation(
      { customer_id: cart.customer_id ?? null, company_id: cart.company?.id ?? null },
      cart.customer?.employee?.company_id ?? null,
    );
    if (approval.type !== ApprovalType.ADMIN || !employee?.is_admin || !verified ||
      !cart.company?.id || employee.company_id !== cart.company.id) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, 'Forbidden');
    }
    return new StepResponse(input);
  },
);
