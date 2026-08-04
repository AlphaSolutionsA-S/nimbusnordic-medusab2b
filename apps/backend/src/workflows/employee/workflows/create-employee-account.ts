import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { registerCustomerIdentityStep } from "../steps/register-customer-identity";
import { createEmployeesWorkflow } from "./create-employees";

type WorkflowInput = {
  customerData: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  password: string;
  employeeData: {
    company_id: string;
    spending_limit: number;
    is_admin: boolean;
  };
};

export const createEmployeeAccountWorkflow = createWorkflow(
  "create-employee-account",
  function (input: WorkflowInput) {
    const authIdentityId = registerCustomerIdentityStep({
      email: input.customerData.email,
      password: input.password,
    });

    const customer = createCustomerAccountWorkflow.runAsStep({
      input: {
        authIdentityId,
        customerData: input.customerData,
      },
    });

    const employeeData = transform(
      { input, customer },
      ({ input, customer }) => ({
        ...input.employeeData,
        customer_id: customer.id,
      })
    );

    const employee = createEmployeesWorkflow.runAsStep({
      input: {
        employeeData,
        customerId: customer.id,
      },
    });

    return new WorkflowResponse({ customer, employee });
  }
);
