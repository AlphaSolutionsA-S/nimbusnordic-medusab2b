import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { removeCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { ModuleEmployee } from "../../../types";
import {
  deleteAuthIdentityStep,
  deleteEmployeesStep,
  getCustomerAuthIdentityStep,
} from "../steps";

type WorkflowInput = {
  employee_id: string;
  company_id: string;
  delete_customer_account?: boolean;
};

export const deleteEmployeesWorkflow = createWorkflow(
  "delete-employees",
  function (input: WorkflowInput): WorkflowResponse<ModuleEmployee> {
    const employee = deleteEmployeesStep(input);

    when(input, (input) => !!input.delete_customer_account).then(() => {
      const customerId = transform({ employee }, ({ employee }) => {
        return employee.customer.id;
      });

      const customerEmail = transform({ employee }, ({ employee }) => {
        return employee.customer.email;
      });

      const authIdentityId = getCustomerAuthIdentityStep(customerEmail);      

      removeCustomerAccountWorkflow.runAsStep({
        input: {
          customerId,
        },
      });

      deleteAuthIdentityStep(authIdentityId);
    });

    return new WorkflowResponse(employee);
  }
);
