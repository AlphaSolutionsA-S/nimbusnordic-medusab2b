import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: ["employee.company.business_central_customer_number"],
    filters: { id: customer_id },
  });

  const bcCustomerNumber =
    customer?.employee?.company?.business_central_customer_number as
      | string
      | undefined
      | null;

  if (!bcCustomerNumber) {
    res.status(400).json({
      message:
        "No Business Central customer number configured for this company.",
    });
    return;
  }

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
  const order = await bcService.getOrder({
    customerNumber: bcCustomerNumber,
    orderId: req.params.id,
  });

  if (!order) {
    res.status(404).json({ message: "Order not found." });
    return;
  }

  res.json({ order });
};