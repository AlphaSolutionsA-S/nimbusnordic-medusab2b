import { randomUUID } from "node:crypto";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import type { ILockingModule } from "@medusajs/framework/types";
import {
  BC_SUBMISSION_RESERVATION_TTL,
  getBcSubmissionReservationKey,
} from "../utils/submission-reservation";

type BcSubmissionRequest = {
  order_id: string;
  force_resend: boolean;
  reservation_owner_id: string;
};
export const reserveBcSubmissionStep = createStep(
  "reserve-bc-submission",
  async (input: { order_id: string; force_resend: boolean }, { container }) => {
    const locking: ILockingModule = container.resolve(Modules.LOCKING);
    const key = getBcSubmissionReservationKey(input.order_id);
    const ownerId = randomUUID();
    try {
      await locking.acquire(key, {
        ownerId,
        expire: BC_SUBMISSION_RESERVATION_TTL,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === `Failed to acquire lock for key "${key}"`
      ) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          "A Business Central submission is already in progress. Use Refresh to check its status."
        );
      }
      throw error;
    }
    return new StepResponse<
      BcSubmissionRequest,
      { key: string; ownerId: string }
    >({ ...input, reservation_owner_id: ownerId }, { key, ownerId });
  },
  async (data, { container }) => {
    if (!data) return;
    const locking: ILockingModule = container.resolve(Modules.LOCKING);
    await locking.release(data.key, { ownerId: data.ownerId });
  }
);
