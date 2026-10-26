import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";

import {
  EMPLOYEE_INVITED_EVENT,
  type EmployeeInvitedEventData,
} from "../workflows/employee/workflows/create-employee-account";
import { sendEmployeeInvitationWorkflow } from "../workflows/employee/workflows/send-employee-invitation";

export default async function employeeInvitedHandler({
  event: { data },
  container,
}: SubscriberArgs<EmployeeInvitedEventData>): Promise<void> {
  await sendEmployeeInvitationWorkflow(container).run({ input: data });
}

export const config: SubscriberConfig = { event: EMPLOYEE_INVITED_EVENT };
