import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";
import { resolveBusinessCentralAccountWorkflow } from "../../../../workflows/company/workflows/resolve-business-central-account";

// Business Central document numbers are Code[20].
const BC_DOCUMENT_NUMBER_MAX_LENGTH = 20;

export const GET = async (
  req: AuthenticatedMedusaRequest,
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

  const returnNumber = req.params.number;

  // Foreign, unknown and impossible numbers all get the same 404.
  if (!returnNumber || returnNumber.length > BC_DOCUMENT_NUMBER_MAX_LENGTH) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
  const bcReturn = await bcService.getReturn(account.environment, {
    customerNumber: bcCustomerNumber,
    returnNumber,
  });

  if (!bcReturn) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  res.json({ return: bcReturn });
};
