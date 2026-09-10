import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { updateCustomerPasswordWorkflow } from "../../../../../workflows/customer/workflows/update-customer-password";
import type { StoreUpdatePasswordType } from "./validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreUpdatePasswordType>,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const { old_password, new_password } = req.validatedBody;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: ["email"],
    filters: { id: customer_id },
  });

  const email = customer?.email as string | undefined;

  if (!email) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found");
  }

  await updateCustomerPasswordWorkflow(req.scope).run({
    input: { email, old_password, new_password },
  });

  res.status(200).json({ success: true });
};
