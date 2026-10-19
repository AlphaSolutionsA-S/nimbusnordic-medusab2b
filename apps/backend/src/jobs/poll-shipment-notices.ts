import { randomUUID } from "node:crypto";
import type { ILockingModule, Logger, MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  defineFileConfig,
  Modules,
} from "@medusajs/framework/utils";
import { shipmentPollLogLines } from "../workflows/shipment-notice/utils/shipment-poll";
import {
  pollShipmentNoticesWorkflow,
} from "../workflows/shipment-notice/workflows/poll-shipment-notices";

export const SHIPMENT_NOTICE_POLL_LOCK_KEY = "shipment-notice-poll";

/**
 * Longer than the worst-case run: the 4-minute deadline, then at most one in-flight 20-second BC
 * request and the database writes after it.
 */
export const SHIPMENT_NOTICE_POLL_LOCK_TTL_SECONDS = 600;

// The scheduler would otherwise fire this job every minute inside every integration spec, against
// that spec's stubs and database; specs that need the job call it directly.
defineFileConfig({ isDisabled: () => process.env.NODE_ENV === "test" });

/**
 * Polls Business Central for shipments of API orders (NIMBUS-130). One run at a time: a run that
 * finds the lock held is skipped, and every run releases its own lock.
 */
export default async function pollShipmentNoticesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const locking = container.resolve<ILockingModule>(Modules.LOCKING);
  const ownerId = randomUUID();

  try {
    await locking.acquire(SHIPMENT_NOTICE_POLL_LOCK_KEY, {
      ownerId,
      expire: SHIPMENT_NOTICE_POLL_LOCK_TTL_SECONDS,
    });
  } catch {
    logger.info("Shipment notice poll skipped: the previous run is still running");
    return;
  }

  const startedAt = Date.now();
  try {
    const { result } = await pollShipmentNoticesWorkflow(container).run();
    const lines = shipmentPollLogLines(result, Date.now() - startedAt);
    logger.info(lines.summary);
    lines.warnings.forEach((warning) => logger.warn(warning));
  } catch (error) {
    // Only the error type: a BC token failure's message can carry the response text.
    logger.error(
      `Shipment notice poll failed after ${Date.now() - startedAt} ms (${errorType(error)})`
    );
  } finally {
    await locking
      .release(SHIPMENT_NOTICE_POLL_LOCK_KEY, { ownerId })
      .catch(() => logger.warn("Shipment notice poll: the lock could not be released"));
  }
}

/** A failed workflow rejects with a serialised object, not an `Error`. */
function errorType(error: unknown): string {
  if (typeof error === "object" && error !== null && "type" in error) {
    return String(error.type);
  }
  return error instanceof Error ? error.name : "unknown";
}

export const config = {
  name: "shipment-notice-poll",
  schedule: "* * * * *",
};
