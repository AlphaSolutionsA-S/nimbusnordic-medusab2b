import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCListOrdersParams,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import type { StoreBCOrdersQueryType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<never, StoreBCOrdersQueryType>,
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
    fields: [
      "employee.company.id",
      "employee.company.business_central_customer_number",
    ],
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

  const { limit, offset, status, date_from, date_to, search } =
    req.validatedQuery as StoreBCOrdersQueryType;

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

  const bcParams: BCListOrdersParams = {
    customerNumber: bcCustomerNumber,
    limit: limit ?? 20,
    offset: offset ?? 0,
    status,
    date_from,
    date_to,
    search,
  };

  const result = await bcService.listOrders(bcParams);

  res.json(result);
};
