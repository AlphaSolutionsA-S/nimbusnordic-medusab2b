import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import {
  BusinessCentralThrottledError,
  ShipmentReadDeadlineError,
  chunkShipmentNumbers,
} from "../../../modules/business-central/shipment-reads";
import type {
  BCShipment,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import type OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import { decideShipmentNotice } from "../utils/decide-shipment-notice";
import { isCurrentBcOrder } from "../utils/match-shipment-order";
import {
  scheduleShipmentCheck,
  type ShipmentCheckOutcome,
  type ShipmentScheduleRow,
} from "../utils/shipment-check-schedule";
import type { DueShipmentCheck } from "./prepare-shipment-checks";

/** The code stored in `last_error` and logged for a failed check; never BC text. */
export type ShipmentCheckErrorCode = "unpairable" | "not_returned" | "bc_error";

export type CheckShipmentsInput = {
  checks: DueShipmentCheck[];
  /** No BC request starts after it; rows not read by then stay due, unchanged. */
  deadline: Date | string;
};

export type CheckShipmentsResult = {
  checked: number;
  recorded: number;
  unchanged: number;
  conflicts: number;
  errors: number;
  throttled: boolean;
  retry_after_seconds: number | null;
};

function scheduleRow(check: DueShipmentCheck): ShipmentScheduleRow {
  return {
    attempts: check.attempts,
    last_error: check.last_error,
    final_check_done: check.final_check_done,
    recheck_until: new Date(check.recheck_until),
    reopened_at: check.reopened_at ? new Date(check.reopened_at) : null,
    last_checked_at: check.last_checked_at ? new Date(check.last_checked_at) : null,
  };
}

/**
 * Flow C of NIMBUS-130 for one batch of due rows: reads the shipments from BC 20 numbers per
 * request, decides each against its expected revision, stores a "record" against that revision
 * and reschedules or closes the row.
 *
 * BC data (names, addresses) stays inside this step and is never a step result. Nothing is
 * compensated: a stored notice may already have been read by a customer, and each row update
 * only records a check that happened. Logs and `last_error` carry numbers and codes only.
 */
export const checkShipmentsStep = createStep(
  "check-shipments",
  async (
    input: CheckShipmentsInput,
    { container }
  ): Promise<StepResponse<CheckShipmentsResult>> => {
    const bc = container.resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
    const orderIngestion =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const deadline = new Date(input.deadline).getTime();
    const result: CheckShipmentsResult = {
      checked: 0,
      recorded: 0,
      unchanged: 0,
      conflicts: 0,
      errors: 0,
      throttled: false,
      retry_after_seconds: null,
    };

    const apply = async (
      check: DueShipmentCheck,
      outcome: ShipmentCheckOutcome,
      now: Date
    ): Promise<void> => {
      const schedule = scheduleShipmentCheck(scheduleRow(check), outcome, now);
      result.checked += 1;
      if (schedule.action === "close") {
        await orderIngestion.closeShipmentTracking(check.bc_shipment_id, schedule);
        if (schedule.close_reason === "gave_up") {
          logger.error(
            `Shipment notice: shipment ${check.shipment_number} (BC order ` +
              `${check.bc_order_number}) gave up after ${schedule.attempts} failed checks: ` +
              `${schedule.last_error}`
          );
        }
      } else {
        await orderIngestion.rescheduleShipmentTracking(check.bc_shipment_id, schedule);
      }
    };

    const fail = async (
      check: DueShipmentCheck,
      error: ShipmentCheckErrorCode,
      now: Date,
      detail = ""
    ): Promise<void> => {
      result.errors += 1;
      logger.warn(
        `Shipment notice: check of shipment ${check.shipment_number} (BC order ` +
          `${check.bc_order_number}) failed: ${error}${detail}`
      );
      await apply(check, { kind: "failed", error }, now);
    };

    const check = async (item: DueShipmentCheck, shipment: BCShipment, now: Date) => {
      const decision = decideShipmentNotice({
        shipment,
        order: {
          order_id: item.order_id,
          external_order_number: item.external_order_number,
          bc_order_number: item.bc_order_number,
          posting_date: item.posting_date,
          bc_lines: item.bc_lines,
        },
        latest: item.expected,
      });

      if (decision.kind === "unpairable") {
        await fail(item, "unpairable", now, ` at BC line ${decision.sequence}`);
        return;
      }
      if (decision.kind === "nothing") {
        result.unchanged += 1;
        await apply(item, { kind: "checked" }, now);
        return;
      }

      const stored = await orderIngestion.storeShipmentNotice({
        bc_shipment_id: item.bc_shipment_id,
        expected_revision: item.expected?.revision ?? 0,

        company_id: item.company_id,
        order_id: item.order_id,
        external_order_number: item.external_order_number,
        bc_order_number: item.bc_order_number,
        shipment_number: item.shipment_number,
        shipment_date: item.posting_date,
        bc_last_modified_at: new Date(shipment.lastModifiedDateTime),
        status: decision.status,
        content_hash: decision.content_hash,
        payload: decision.payload,
        tracking: scheduleShipmentCheck(
          scheduleRow(item),
          { kind: decision.status === "cancelled" ? "cancelled" : "checked" },
          now
        ),
      });

      if (stored.outcome === "stored") {
        result.recorded += 1;
        result.checked += 1;
      } else if (stored.outcome === "unchanged") {
        result.unchanged += 1;
        await apply(item, { kind: "checked" }, now);
      } else {
        result.conflicts += 1;
        await apply(item, { kind: "conflict" }, now);
      }
    };

    const current: DueShipmentCheck[] = [];
    for (const item of input.checks) {
      const state = { bc_order_number: item.current_bc_order_number };
      if (!item.company_enabled) {
        // Closed for good, before any BC read: switching the company on again does not reopen it.
        await apply(item, { kind: "company_not_enabled" }, new Date());
      } else if (isCurrentBcOrder(item.bc_order_number, state)) {
        current.push(item);
      } else {
        // A force resend replaced the BC order: its shipments are no longer the order's.
        await apply(item, { kind: "superseded" }, new Date());
      }
    }

    const byNumber = new Map(current.map((item) => [item.shipment_number, item]));
    for (const numbers of chunkShipmentNumbers(current.map((item) => item.shipment_number))) {
      if (Date.now() >= deadline) {
        break;
      }
      const items = numbers.flatMap((number) => byNumber.get(number) ?? []);

      let shipments: BCShipment[];
      try {
        shipments = await bc.getShipmentsByNumbers(numbers, deadline);
      } catch (error) {
        if (error instanceof ShipmentReadDeadlineError) {
          break;
        }
        if (error instanceof BusinessCentralThrottledError) {
          result.throttled = true;
          result.retry_after_seconds = error.retryAfterSeconds;
          break;
        }
        // The error's message is not logged: a token failure's message can carry response text.
        const now = new Date();
        for (const item of items) {
          await fail(item, "bc_error", now);
        }
        continue;
      }

      const now = new Date();
      const byId = new Map(shipments.map((shipment) => [shipment.id, shipment]));
      for (const item of items) {
        const shipment = byId.get(item.bc_shipment_id);
        if (shipment) {
          await check(item, shipment, now);
        } else {
          await fail(item, "not_returned", now);
        }
      }
    }

    return new StepResponse(result);
  }
);
