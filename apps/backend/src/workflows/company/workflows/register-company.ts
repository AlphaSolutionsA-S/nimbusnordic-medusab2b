import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import type { StoreCreateCompanyType } from '../../../api/store/companies/validators';
import { ModuleCompanySpendingLimitResetFrequency } from '../../../types/company';
import { createEmployeesWorkflow } from '../../employee/workflows/create-employees';
import { validateCompanyRegistrationStep } from '../steps/validate-company-registration';
import { createCompaniesWorkflow } from './create-companies';

export const registerCompanyWorkflow = createWorkflow(
  'register-company',
  function (input: { company: StoreCreateCompanyType; customer_id: string }) {
    const customerId = validateCompanyRegistrationStep(input.customer_id);
    const companyData = transform({ input, customerId }, ({ input }) => [{
      ...input.company,
      phone: input.company.phone ?? '',
      address: input.company.address ?? null,
      city: input.company.city ?? null,
      state: input.company.state ?? null,
      zip: input.company.zip ?? null,
      country: input.company.country ?? null,
      logo_url: input.company.logo_url ?? null,
      spending_limit_reset_frequency: (input.company.spending_limit_reset_frequency ??
        'never') as ModuleCompanySpendingLimitResetFrequency,
    }]);
    const companies = createCompaniesWorkflow.runAsStep({ input: companyData });
    const employee = createEmployeesWorkflow.runAsStep({
      input: {
        customerId,
        employeeData: {
          company_id: companies[0].id,
          customer_id: customerId,
          is_admin: true,
          spending_limit: 0,
        },
      },
    });
    return new WorkflowResponse({ companies, employee });
  },
);
