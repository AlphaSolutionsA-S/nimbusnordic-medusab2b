import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import pollShipmentNoticesJob, {
  config,
  SHIPMENT_NOTICE_POLL_LOCK_KEY,
} from "../poll-shipment-notices";
import {
  pollShipmentNoticesWorkflow,
} from "../../workflows/shipment-notice/workflows/poll-shipment-notices";

jest.mock("../../workflows/shipment-notice/workflows/poll-shipment-notices", () => ({
  pollShipmentNoticesWorkflow: jest.fn(),
}));

/** Holds keys like the locking module: acquiring a key another owner holds throws. */
class FakeLocking {
  held = new Map<string, { ownerId: string; expire: number }>();

  async acquire(key: string, options: { ownerId: string; expire: number }): Promise<void> {
    const current = this.held.get(key);
    if (current && current.ownerId !== options.ownerId) {
      throw new Error(`Failed to acquire lock for key "${key}"`);
    }
    this.held.set(key, { ownerId: options.ownerId, expire: options.expire });
  }

  async release(key: string, options: { ownerId: string }): Promise<boolean> {
    if (this.held.get(key)?.ownerId !== options.ownerId) {
      return false;
    }
    this.held.delete(key);
    return true;
  }
}

describe("shipment notice poll job", () => {
  let locking: FakeLocking;
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let run: jest.Mock;
  let container: MedusaContainer;

  beforeEach(() => {
    locking = new FakeLocking();
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    run = jest.fn();
    jest.mocked(pollShipmentNoticesWorkflow).mockReturnValue({ run } as never);
    const registrations: Record<string, unknown> = {
      [Modules.LOCKING]: locking,
      [ContainerRegistrationKeys.LOGGER]: logger,
    };
    container = { resolve: (key: string) => registrations[key] } as never;
  });

  it("runs every minute", () => {
    expect(config.schedule).toBe("* * * * *");
  });

  it("skips the run without running the workflow while another run holds the lock", async () => {
    await locking.acquire(SHIPMENT_NOTICE_POLL_LOCK_KEY, { ownerId: "other-run", expire: 600 });

    await pollShipmentNoticesJob(container);

    expect(run).not.toHaveBeenCalled();
    expect(locking.held.get(SHIPMENT_NOTICE_POLL_LOCK_KEY)?.ownerId).toBe("other-run");
  });

  it("holds the lock for 10 minutes during the run and releases it afterwards", async () => {
    let heldDuringRun: { ownerId: string; expire: number } | undefined;
    run.mockImplementation(async () => {
      heldDuringRun = locking.held.get(SHIPMENT_NOTICE_POLL_LOCK_KEY);
      return { result: { backed_off: true } };
    });

    await pollShipmentNoticesJob(container);

    expect(heldDuringRun?.expire).toBe(600);
    expect(locking.held.has(SHIPMENT_NOTICE_POLL_LOCK_KEY)).toBe(false);
  });

  it("releases the lock after a failing run and logs no error message", async () => {
    // A workflow rejects with a serialised error; a BC token failure's text is not logged.
    run.mockRejectedValue({ message: "token rejected: Jane Receiver", type: "unexpected_state" });

    await expect(pollShipmentNoticesJob(container)).resolves.toBeUndefined();

    expect(locking.held.has(SHIPMENT_NOTICE_POLL_LOCK_KEY)).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain("unexpected_state");
    expect(logger.error.mock.calls[0][0]).not.toContain("Jane Receiver");
  });

  it("uses a new owner per run, so a run never releases another run's lock", async () => {
    const owners: string[] = [];
    run.mockImplementation(async () => {
      owners.push(locking.held.get(SHIPMENT_NOTICE_POLL_LOCK_KEY)!.ownerId);
      return { result: { backed_off: true } };
    });

    await pollShipmentNoticesJob(container);
    await pollShipmentNoticesJob(container);

    expect(owners).toHaveLength(2);
    expect(owners[0]).not.toBe(owners[1]);
  });
});
