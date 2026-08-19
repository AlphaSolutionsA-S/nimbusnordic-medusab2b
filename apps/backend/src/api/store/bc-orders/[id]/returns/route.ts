import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { BusinessCentralAmbiguousOutcomeError } from "../../../../../modules/business-central/service";
import { createBcReturnWorkflow } from "../../../../../workflows/business-central-return/workflows/create-bc-return";
import type { StoreCreateBCReturnType } from "./validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateBCReturnType>,
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
      message: "No Business Central customer number configured for this company.",
    });
    return;
  }

  try {
    const { result } = await createBcReturnWorkflow(req.scope).run({
      input: {
        customerId: customer_id,
        bcCustomerNumber,
        sourceSalesOrderId: req.params.id,
        lines: req.validatedBody.lines.map((line) => ({
          sourceLineNo: line.source_line_no,
          quantityToReturn: line.quantity,
          returnReasonCode: line.return_reason_code,
        })),
      },
    });

    res.json({ return: result });
  } catch (error) {
    if (error instanceof BusinessCentralAmbiguousOutcomeError) {
      res.status(503).json({
        message:
          "We could not confirm the return request. Please try again shortly.",
      });
      return;
    }

    if (error instanceof MedusaError) {
      if (error.type === MedusaError.Types.NOT_FOUND) {
        res.status(404).json({ message: "Order not found." });
        return;
      }

      if (error.type === MedusaError.Types.INVALID_DATA) {
        res.status(400).json({ message: error.message });
        return;
      }
    }

    res.status(500).json({
      message: "The return request could not be completed. Please try again later.",
    });
  }
};
