import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCListReturnsParams,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import type { StoreBCReturnsQueryType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<never, StoreBCReturnsQueryType>,
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

  const { limit, offset, state, date_from, date_to, search } =
    req.validatedQuery as StoreBCReturnsQueryType;

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);

  const bcParams: BCListReturnsParams = {
    customerNumber: bcCustomerNumber,
    limit: limit ?? 20,
    offset: offset ?? 0,
    state,
    date_from,
    date_to,
    search,
  };

  const result = await bcService.listReturns(bcParams);

  res.json(result);
};
