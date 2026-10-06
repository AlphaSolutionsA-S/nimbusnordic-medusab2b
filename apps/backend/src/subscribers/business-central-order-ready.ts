import { randomUUID } from "node:crypto";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import type { ILockingModule, Logger } from "@medusajs/framework/types";
import { SkipExecutionError } from "@medusajs/framework/orchestration";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { READY_FOR_BUSINESS_CENTRAL_EVENT } from "../workflows/order-ingestion/workflows/enrich-order";
import {
  getSendOrderToBusinessCentralTransactionId,
  sendOrderToBusinessCentralWorkflow,
} from "../workflows/business-central-order/workflows/send-order-to-business-central";
import {
  ADMIN_BC_SUBMISSION_REQUESTED_EVENT,
  BC_SUBMISSION_RESERVATION_TTL,
  BC_SUBMISSION_RESERVATION_RENEWAL_MS,
  getBcSubmissionReservationKey,
} from "../workflows/business-central-order/utils/submission-reservation";

type ReadyForBusinessCentralEventData = {
  order_id: string;
  force_resend?: boolean;
  reservation_owner_id?: string;
};

export default async function businessCentralOrderReadyHandler({
  event: { data },
  container,
}: SubscriberArgs<ReadyForBusinessCentralEventData>) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const locking: ILockingModule = container.resolve(Modules.LOCKING);
  const key = getBcSubmissionReservationKey(data.order_id);
  const ownerId = data.reservation_owner_id ?? randomUUID();
  let acquired = false;
  let renewalTimer: ReturnType<typeof setInterval> | undefined;
  let pendingRenewal: Promise<void> = Promise.resolve();
  try {
    await locking.acquire(key, {
      ownerId,
      expire: BC_SUBMISSION_RESERVATION_TTL,
    });
    acquired = true;
    // Business Central lookups may outlast the initial lease; keep the accepted start reserved.
    renewalTimer = setInterval(() => {
      pendingRenewal = pendingRenewal
        .then(() =>
          locking.acquire(key, {
            ownerId,
            expire: BC_SUBMISSION_RESERVATION_TTL,
          })
        )
        .catch(() => {
          logger.error(
            `Business Central submission reservation for order ${data.order_id} could not be renewed`
          );
        });
    }, BC_SUBMISSION_RESERVATION_RENEWAL_MS);
    renewalTimer.unref();

    const { result } = await sendOrderToBusinessCentralWorkflow(container).run({
      input: {
        order_id: data.order_id,
        force_resend: data.force_resend ?? false,
      },
      context: {
        transactionId: getSendOrderToBusinessCentralTransactionId(
          data.order_id
        ),
      },
    });
    logger.info(
      `Business Central submission for order ${data.order_id} finished with status ${result.status}`
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === `Failed to acquire lock for key "${key}"` ||
        SkipExecutionError.isSkipExecutionError(error))
    ) {
      logger.info(
        `Business Central submission for order ${data.order_id} skipped: another submission is already running`
      );
      return;
    }
    logger.error(
      `Business Central submission for order ${data.order_id} could not run`
    );
  } finally {
    if (renewalTimer) {
      clearInterval(renewalTimer);
    }
    // Drain renewal before releasing, so a pending renewal cannot reacquire a completed run's lock.
    await pendingRenewal;

    if (acquired) {
      await locking.release(key, { ownerId });
    }
  }
}
export const config: SubscriberConfig = {
  event: [
    READY_FOR_BUSINESS_CENTRAL_EVENT,
    ADMIN_BC_SUBMISSION_REQUESTED_EVENT,
  ],
};
