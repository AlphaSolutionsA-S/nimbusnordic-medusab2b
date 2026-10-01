import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { AdminSubmitOrderToBcType } from "../validators";
import { requestBcSubmissionWorkflow } from "../../../../../../workflows/business-central-order/workflows/request-bc-submission";
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSubmitOrderToBcType>,
  res: MedusaResponse
) => {
  await requestBcSubmissionWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      force_resend: req.validatedBody.force_resend,
    },
  });
  res
    .status(202)
    .json({
      message:
        "Business Central submission has been accepted. Use Refresh to check the outcome.",
    });
};
