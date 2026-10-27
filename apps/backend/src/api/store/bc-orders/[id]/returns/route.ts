import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  BC_RETURN_VALIDATION_ERROR,
  createBcReturnWorkflow,
} from "../../../../../workflows/business-central-return/workflows/create-bc-return";
import { resolveBusinessCentralAccountWorkflow } from "../../../../../workflows/company/workflows/resolve-business-central-account";
import type { StoreCreateBCReturnType } from "./validators";

type ReturnFailureAnswer = { status: number; message: string };

const UNEXPECTED_FAILURE_ANSWER: ReturnFailureAnswer = {
  status: 500,
  message: "The return request could not be completed. Please try again later.",
};

// A failed workflow rejects with the serialised error (its name, message and own fields), not the
// thrown instance, so the answer is read from those fields rather than with `instanceof`.
function getReturnFailureAnswer(error: unknown): ReturnFailureAnswer | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const failure: { name?: unknown; type?: unknown; message?: unknown } = error;

  if (failure.name === "BusinessCentralAmbiguousOutcomeError") {
    return {
      status: 503,
      message: "We could not confirm the return request. Please try again shortly.",
    };
  }

  // Only the return's own line validation is shopper-facing; other invalid-data errors (Business
  // Central configuration or rejection) stay the logged generic 500.
  if (failure.name === BC_RETURN_VALIDATION_ERROR && typeof failure.message === "string") {
    return { status: 400, message: failure.message };
  }

  if (MedusaError.isMedusaError(error) && failure.type === MedusaError.Types.NOT_FOUND) {
    return { status: 404, message: "Order not found." };
  }

  return null;
}

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateBCReturnType>,
  res: MedusaResponse
): Promise<void> => {
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };
  const { result: account } = await resolveBusinessCentralAccountWorkflow(
    req.scope
  ).run({ input: { customerId: customer_id } });

  if (!account.customerNumber) {
    res.status(400).json({
      message: "No Business Central customer number configured for this company.",
    });
    return;
  }

  try {
    const { result } = await createBcReturnWorkflow(req.scope).run({
      input: {
        customerId: customer_id,
        bcCustomerNumber: account.customerNumber,
        environment: account.environment,
        sourceOrderNumber: req.params.id,
        lines: req.validatedBody.lines.map((line) => ({
          sourceLineNo: line.source_line_no,
          quantityToReturn: line.quantity,
          returnReasonCode: line.return_reason_code,
        })),
      },
    });

    res.json({ return: result });
  } catch (error) {
    const answer = getReturnFailureAnswer(error);

    if (!answer) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error("BC return request failed");
    }

    const { status, message } = answer ?? UNEXPECTED_FAILURE_ANSWER;
    res.status(status).json({ message });
  }
};
