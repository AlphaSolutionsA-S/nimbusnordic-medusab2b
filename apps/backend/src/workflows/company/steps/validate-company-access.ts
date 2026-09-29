import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

export interface CompanyAccessInput {
  customer_id: string;
  company_id?: string;
  employee_id?: string;
  require_admin: boolean;
}

export const validateCompanyAccessStep = createStep(
  'validate-company-access',
  async (input: CompanyAccessInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: [customer] } = await query.graph({
      entity: 'customer',
      fields: ['id', 'employee.company_id', 'employee.is_admin'],
      filters: { id: input.customer_id },
    });
    const employee = customer?.employee;
    const companyId = input.company_id ?? employee?.company_id;

    if (input.company_id) {
      await query.graph({
        entity: 'company',
        fields: ['id'],
        filters: { id: input.company_id },
      }, { throwIfKeyNotFound: true });
    }

    if (!companyId || employee?.company_id !== companyId ||
      (input.require_admin && !employee.is_admin)) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, 'Forbidden');
    }

    if (input.employee_id) {
      const { data: [target] } = await query.graph({
        entity: 'employee',
        fields: ['id'],
        filters: { id: input.employee_id, company_id: companyId },
      });
      if (!target) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Employee not found');
      }
    }

    return new StepResponse(companyId);
  },
);
