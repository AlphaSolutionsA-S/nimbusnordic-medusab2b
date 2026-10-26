import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createCustomerAccountWorkflow,
  emitEventStep,
} from "@medusajs/medusa/core-flows";
import { registerCustomerIdentityStep } from "../steps/register-customer-identity";
import { createEmployeesWorkflow } from "./create-employees";

export const EMPLOYEE_INVITED_EVENT = "employee.invited";

export type EmployeeInvitedEventData = {
  customer_id: string;
  company_id: string;
  country_code: string | null;
};

type WorkflowInput = {
  country_code?: string;
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

    // Ids and the page country only: the invitation email reads personal data server-side.
    // Staged, so the event is released only if the account creation succeeds (NIMBUS-242).
    const invitation = transform(
      { input, customer },
      ({ input, customer }): EmployeeInvitedEventData => ({
        customer_id: customer.id,
        company_id: input.employeeData.company_id,
        country_code: input.country_code ?? null,
      })
    );

    emitEventStep({ eventName: EMPLOYEE_INVITED_EVENT, data: invitation });

    return new WorkflowResponse({ customer, employee });
  }
);
