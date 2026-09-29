import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import type { ModuleUpdateApproval } from '../../../types';
import { validateCompanyApprovalStep } from '../steps/validate-company-approval';
import { updateApprovalsWorkflow } from './update-approval';

export const updateCompanyApprovalWorkflow = createWorkflow(
  'update-company-approval',
  function (input: ModuleUpdateApproval) {
    const authorizedInput = validateCompanyApprovalStep(input);
    return new WorkflowResponse(updateApprovalsWorkflow.runAsStep({ input: authorizedInput }));
  },
);
