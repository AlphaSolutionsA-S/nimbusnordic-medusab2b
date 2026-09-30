import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../../modules/business-central";
import type { IBusinessCentralModuleService } from "../../../../modules/business-central/types";

// Business Central document numbers are Code[20].
const BC_DOCUMENT_NUMBER_MAX_LENGTH = 20;

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

  const returnNumber = req.params.number;

  // Foreign, unknown and impossible numbers all get the same 404.
  if (!returnNumber || returnNumber.length > BC_DOCUMENT_NUMBER_MAX_LENGTH) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  const bcService =
    req.scope.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
  const bcReturn = await bcService.getReturn({
    customerNumber: bcCustomerNumber,
    returnNumber,
  });

  if (!bcReturn) {
    res.status(404).json({ message: "Return not found." });
    return;
  }

  res.json({ return: bcReturn });
};
