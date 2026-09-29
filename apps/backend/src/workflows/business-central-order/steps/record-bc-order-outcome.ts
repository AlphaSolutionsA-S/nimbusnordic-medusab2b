import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../modules/order-ingestion/bc-integration-state";
import type { BcSubmissionOutcome } from "./submit-bc-order";

export type RecordBcOrderOutcomeCompensationData = {
  orderId: string;
  previousState: unknown;
};

export const recordBcOrderOutcomeStep = createStep(
  "record-bc-order-outcome",
  async (
    input: BcSubmissionOutcome,
    { container }
  ): Promise<
    StepResponse<BcIntegrationState, RecordBcOrderOutcomeCompensationData>
  > => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const [order] = await orderModuleService.listOrders(
      { id: input.orderId },
      { select: ["id", "metadata"] }
    );
    const previousMetadata = (order?.metadata ?? {}) as Record<string, unknown>;
    const previousState = parseBcIntegrationState(
      previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY]
    );

    // A short-circuited (duplicate-guarded) invocation made no attempt: leave everything as it was.
    if (input.status === "skipped") {
      return new StepResponse(previousState, {
        orderId: input.orderId,
        previousState: previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY],
      });
    }

    const now = new Date().toISOString();
    const nextState: BcIntegrationState = {
      status: input.status,
      bc_order_id: input.bcOrderId,
      bc_order_number: input.bcOrderNumber,
      attempt_count: previousState.attempt_count + 1,
      initialized_at: previousState.initialized_at,
      last_attempt_at: now,
      sent_at: input.status === "sent" ? now : previousState.sent_at,
      partial: input.partial,
      failure_reason: input.failureReason,
      line_failures: input.lineFailures,
    };

    // metadata is one jsonb column: read-merge-write, or this update would wipe out
    // canonical_order, company_id and order_ingestion_state. IOrderModuleService.updateOrders takes
    // the TWO-argument (id, data) form — same as update-order-ingestion-state.ts.
    await orderModuleService.updateOrders(input.orderId, {
      metadata: {
        ...previousMetadata,
        [BC_INTEGRATION_STATE_METADATA_KEY]: nextState,
      },
    });

    return new StepResponse(nextState, {
      orderId: input.orderId,
      previousState: previousMetadata[BC_INTEGRATION_STATE_METADATA_KEY],
    });
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const [order] = await orderModuleService.listOrders(
      { id: compensationData.orderId },
      { select: ["id", "metadata"] }
    );
    const currentMetadata = (order?.metadata ?? {}) as Record<string, unknown>;

    await orderModuleService.updateOrders(compensationData.orderId, {
      metadata: {
        ...currentMetadata,
        [BC_INTEGRATION_STATE_METADATA_KEY]: compensationData.previousState,
      },
    });
  }
);
