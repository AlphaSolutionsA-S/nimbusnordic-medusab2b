import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { CompanyAccessInput, validateCompanyAccessStep } from '../steps/validate-company-access';

export const authorizeCompanyAccessWorkflow = createWorkflow(
  'authorize-company-access',
  function (input: CompanyAccessInput) {
    return new WorkflowResponse(validateCompanyAccessStep(input));
  },
);
