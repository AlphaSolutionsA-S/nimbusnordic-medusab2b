import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCListReturnsParams,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import { resolveBusinessCentralAccountWorkflow } from "../../../workflows/company/workflows/resolve-business-central-account";
import type { StoreBCReturnsQueryType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<never, StoreBCReturnsQueryType>,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const { result: account } = await resolveBusinessCentralAccountWorkflow(
    req.scope
  ).run({ input: { customerId: customer_id } });
  const bcCustomerNumber = account.customerNumber;

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

  const result = await bcService.listReturns(account.environment, bcParams);

  res.json(result);
};
