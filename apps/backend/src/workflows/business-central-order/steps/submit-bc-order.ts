import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import { BusinessCentralAmbiguousOutcomeError } from "../../../modules/business-central/service";
import type { IBusinessCentralModuleService } from "../../../modules/business-central/types";
import type {
  BcOrderLineFailure,
  BcSubmissionFailureReason,
} from "../../../modules/order-ingestion/bc-integration-state";
import type { PreparedBcOrder } from "./prepare-bc-order";

export type BcSubmissionStatus = "skipped" | "sent" | "failed";

export type BcSubmissionOutcome = {
  orderId: string;
  status: BcSubmissionStatus;
  bcOrderId: string | null;
  bcOrderNumber: string | null;
  partial: boolean;
  failureReason: BcSubmissionFailureReason | null;
  lineFailures: BcOrderLineFailure[];
};

export const submitBcOrderStep = createStep(
  "submit-bc-order",
  async (
    input: PreparedBcOrder,
    { container }
  ): Promise<StepResponse<BcSubmissionOutcome>> => {
    if (input.outcome === "skip") {
      return new StepResponse({
        orderId: input.orderId,
        status: "skipped",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: false,
        failureReason: null,
        lineFailures: [],
      });
    }

    if (input.outcome === "abort" || !input.params) {
      return new StepResponse({
        orderId: input.orderId,
        status: "failed",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: input.lineFailures.length > 0,
        failureReason: input.failureReason ?? "bc_submission_failed",
        lineFailures: input.lineFailures,
      });
    }

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    try {
      const created = await bcService.createSalesOrder(input.params);

      // Logged immediately so the real BC order id is recoverable from logs even if the
      // outcome-recording step fails to persist it (PLAN.md Decision 7).
      logger.info(
        `Business Central sales order ${created.number} (${created.id}) created for Medusa order ${input.orderId}`
      );

      const lineFailures: BcOrderLineFailure[] = [...input.lineFailures];

      for (const rejection of created.rejectedLines) {
        const identifiers = input.lineIdentifiers.find(
          (line) => line.line_number === rejection.lineNumber
        );

        lineFailures.push({
          line_number: rejection.lineNumber,
          ean_no: identifiers?.ean_no ?? null,
          item_number: identifiers?.item_number ?? null,
          cust_item_no: identifiers?.cust_item_no ?? null,
          reason: "rejected_by_bc",
          message: rejection.message,
        });
      }

      const allRejected = created.acceptedLineNumbers.length === 0;
      const failureReason: BcSubmissionFailureReason | null = allRejected
        ? "all_lines_rejected_by_bc"
        : lineFailures.length > 0
          ? "partial_lines_submitted"
          : null;

      return new StepResponse({
        orderId: input.orderId,
        status: allRejected ? "failed" : "sent",
        bcOrderId: created.id,
        bcOrderNumber: created.number,
        partial: lineFailures.length > 0,
        failureReason,
        lineFailures,
      });
    } catch (error) {
      const outcomeUnknown = error instanceof BusinessCentralAmbiguousOutcomeError;

      logger.error(
        `Business Central sales order submission ${
          outcomeUnknown ? "has an unknown outcome" : "failed"
        } for Medusa order ${input.orderId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return new StepResponse({
        orderId: input.orderId,
        status: "failed",
        bcOrderId: null,
        bcOrderNumber: null,
        partial: input.lineFailures.length > 0,
        failureReason: outcomeUnknown
          ? "bc_submission_outcome_unknown"
          : "bc_submission_failed",
        lineFailures: input.lineFailures,
      });
    }
  }
);
