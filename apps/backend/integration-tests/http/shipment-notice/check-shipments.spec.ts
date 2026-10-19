import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, Logger } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import {
  BusinessCentralThrottledError,
} from "../../../src/modules/business-central/shipment-reads";
import type {
  BCShipment,
  BCShipmentLine,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
  type BcOrderLineMapEntry,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type {
  ShipmentTrackingSchedule,
} from "../../../src/modules/order-ingestion/shipment-notice-storage";
import {
  decideShipmentNotice,
} from "../../../src/workflows/shipment-notice/utils/decide-shipment-notice";
import {
  checkShipmentsWorkflow,
} from "../../../src/workflows/shipment-notice/workflows/check-shipments";

jest.setTimeout(180 * 1000);

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const at = (base: Date, offsetMs: number): Date => new Date(base.getTime() + offsetMs);
const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

// Personal data a shipment carries; it must never reach a log line or `last_error`.
const RECEIVER_NAME = "Jane Receiver";
const RECEIVER_STREET = "Secret Street 1";

function line(sequence: number, quantity: number, itemNumber = "ITEM-1"): BCShipmentLine {
  return {
    sequence,
    lineType: "item",
    itemNumber,
    description: "Widget",
    description2: null,
    unitOfMeasureCode: "PCS",
    quantity,
    shipmentDate: null,
  };
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("checkShipmentsWorkflow", () => {
      /** BC's posted shipments by id, as the next read returns them. */
      let bcShipments: Map<string, BCShipment>;
      let getShipmentsByNumbers: jest.SpyInstance;
      let counter = 0;

      const orderIngestion = (): OrderIngestionModuleService =>
        getContainer().resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

      beforeEach(async () => {
        bcShipments = new Map();
        const bc = getContainer().resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
        getShipmentsByNumbers = jest
          .spyOn(bc, "getShipmentsByNumbers")
          .mockImplementation(async (numbers: readonly string[]) =>
            [...bcShipments.values()].filter((shipment) => numbers.includes(shipment.number))
          );
        await orderIngestion().initializeShipmentPollState(at(new Date(), -DAY));
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      async function seedOrder(bcOrderNumber: string, bcLines: BcOrderLineMapEntry[] | null) {
        const orders = getContainer().resolve<IOrderModuleService>(Modules.ORDER);
        return orders.createOrders({
          currency_code: "dkk",
          metadata: {
            [BC_INTEGRATION_STATE_METADATA_KEY]: {
              ...createInitialBcIntegrationState("2026-10-19T08:00:00.000Z"),
              status: "sent",
              bc_order_id: `bc-${bcOrderNumber}`,
              bc_order_number: bcOrderNumber,
              bc_lines: bcLines,
            },
          },
        });
      }

      type Tracked = { id: string; number: string; orderId: string };

      async function track(
        orderId: string,
        options: { due?: Date; recheckUntil?: Date; bcOrderNumber?: string } = {}
      ): Promise<Tracked> {
        counter += 1;
        const now = new Date();
        const tracked = { id: `bc-shp-check-${counter}`, number: `SS-C-${counter}`, orderId };
        await orderIngestion().upsertShipmentTracking([
          {
            bc_shipment_id: tracked.id,
            shipment_number: tracked.number,
            bc_order_number: options.bcOrderNumber ?? "SO-100",
            posting_date: utcDay(now),
            company_id: "comp_shipment_checks",
            order_id: orderId,
            external_order_number: "METZ-1",
            next_check_at: options.due ?? at(now, -MINUTE),
            recheck_until: options.recheckUntil ?? at(now, 14 * DAY),
          },
        ]);
        return tracked;
      }

      function shipment(tracked: Tracked, lines: BCShipmentLine[]): BCShipment {
        return {
          id: tracked.id,
          number: tracked.number,
          orderNumber: "SO-100",
          externalDocumentNumber: "METZ-1",
          customerNumber: "C-100",
          postingDate: utcDay(new Date()),
          lastModifiedDateTime: at(new Date(), -30 * MINUTE).toISOString(),
          shipmentMethodCode: "DHL",
          yourReference: null,
          sellTo: {
            customerNumber: "C-100",
            name: RECEIVER_NAME,
            addressLine1: RECEIVER_STREET,
            addressLine2: null,
            city: "Aarhus",
            state: null,
            postCode: "8000",
            country: "DK",
          },
          billTo: {
            customerNumber: "C-100",
            name: RECEIVER_NAME,
            addressLine1: RECEIVER_STREET,
            addressLine2: null,
            city: "Aarhus",
            state: null,
            postCode: "8000",
            country: "DK",
          },
          shipTo: {
            name: RECEIVER_NAME,
            contact: RECEIVER_NAME,
            addressLine1: RECEIVER_STREET,
            addressLine2: null,
            city: "Aarhus",
            state: null,
            postCode: "8000",
            country: "DK",
          },
          lines,
        };
      }

      function inBc(tracked: Tracked, lines: BCShipmentLine[]): BCShipment {
        const posted = shipment(tracked, lines);
        bcShipments.set(tracked.id, posted);
        return posted;
      }

      async function run(deadline = at(new Date(), 4 * MINUTE)) {
        const { result } = await checkShipmentsWorkflow(getContainer()).run({
          input: { deadline },
        });
        return result;
      }

      async function row(tracked: Tracked) {
        const [found] = await orderIngestion().listShipmentTrackings({
          bc_shipment_id: tracked.id,
        });
        return found;
      }

      async function notices(tracked: Tracked) {
        return orderIngestion().listShipmentNotices(
          { bc_shipment_id: tracked.id },
          { order: { revision: "ASC" } }
        );
      }

      async function makeDue(tracked: Tracked) {
        const { id } = await row(tracked);
        await orderIngestion().updateShipmentTrackings({
          id,
          next_check_at: at(new Date(), -MINUTE),
        });
      }

      /** What a concurrent run stores between this run's expected-revision read and its BC read. */
      async function storeAsAnotherRun(
        tracked: Tracked,
        snapshot: BCShipment,
        tracking: ShipmentTrackingSchedule
      ) {
        const stored = await notices(tracked);
        const latest = stored[stored.length - 1];
        const decision = decideShipmentNotice({
          shipment: snapshot,
          order: {
            order_id: tracked.orderId,
            external_order_number: "METZ-1",
            bc_order_number: "SO-100",
            posting_date: snapshot.postingDate!,
            bc_lines: null,
          },
          latest: {
            revision: latest.revision,
            content_hash: latest.content_hash,
            listed_bc_line_numbers: (latest.payload as { lines: { bc_line_number: number }[] })
              .lines.map((listed) => listed.bc_line_number),
          },
        });
        if (decision.kind !== "record") {
          throw new Error("the other run's snapshot must record a revision");
        }
        await orderIngestion().storeShipmentNotice({
          bc_shipment_id: tracked.id,
          expected_revision: latest.revision,
          company_id: "comp_shipment_checks",
          order_id: tracked.orderId,
          external_order_number: "METZ-1",
          bc_order_number: "SO-100",
          shipment_number: tracked.number,
          shipment_date: snapshot.postingDate!,
          bc_last_modified_at: new Date(snapshot.lastModifiedDateTime),
          status: decision.status,
          content_hash: decision.content_hash,
          payload: decision.payload,
          tracking,
        });
      }

      function loggedText(...spies: jest.SpyInstance[]): string {
        return spies.flatMap((spy) => spy.mock.calls.map((call) => String(call[0]))).join("\n");
      }

      it("records one shipped notice, then nothing for an unchanged re-read", async () => {
        const order = await seedOrder("SO-100", [
          { line_number: 1, ean_no: "5701234567890", bc_sequence: 10000 },
        ]);
        const tracked = await track(order.id);
        inBc(tracked, [line(10000, 5)]);
        const before = Date.now();

        const first = await run();

        expect(first).toMatchObject({
          checked: 1,
          recorded: 1,
          unchanged: 0,
          conflicts: 0,
          errors: 0,
          status: "completed",
        });
        const [notice] = await notices(tracked);
        expect(notice).toMatchObject({ revision: 1, status: "shipped", order_id: order.id });
        expect((notice.payload as { lines: unknown[] }).lines).toEqual([
          expect.objectContaining({ line_number: 1, ean_no: "5701234567890", quantity: 5 }),
        ]);
        const scheduled = await row(tracked);
        expect(scheduled).toMatchObject({ state: "open", latest_revision: 1, attempts: 0 });
        expect(scheduled.next_check_at.getTime()).toBeGreaterThanOrEqual(before + 15 * MINUTE);
        expect(scheduled.next_check_at.getTime()).toBeLessThanOrEqual(Date.now() + 15 * MINUTE);

        await makeDue(tracked);
        const second = await run();

        expect(second).toMatchObject({ checked: 1, recorded: 0, unchanged: 1, errors: 0 });
        expect(await notices(tracked)).toHaveLength(1);
      });

      it("records an undo as revised, and the undo of every line as cancelled", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        inBc(tracked, [line(10000, 5), line(20000, 3, "ITEM-2")]);
        await run();

        await makeDue(tracked);
        inBc(tracked, [line(10000, 5), line(20000, 3, "ITEM-2"), line(30000, -3, "ITEM-2")]);
        await run();

        let stored = await notices(tracked);
        expect(stored.map((notice) => notice.status)).toEqual(["shipped", "revised"]);
        expect((stored[1].payload as { lines: unknown[] }).lines).toEqual([
          expect.objectContaining({ bc_line_number: 10000, quantity: 5 }),
          expect.objectContaining({ bc_line_number: 20000, quantity: 0 }),
        ]);
        expect(await row(tracked)).toMatchObject({ state: "open", latest_revision: 2 });

        await makeDue(tracked);
        inBc(tracked, [
          line(10000, 5),
          line(20000, 3, "ITEM-2"),
          line(30000, -3, "ITEM-2"),
          line(40000, -5),
        ]);
        await run();

        stored = await notices(tracked);
        expect(stored.map((notice) => notice.status)).toEqual(["shipped", "revised", "cancelled"]);
        expect(await row(tracked)).toMatchObject({
          state: "closed",
          close_reason: "cancelled",
          latest_revision: 3,
        });
      });

      it("stores nothing for a stale snapshot after another run cancelled", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        inBc(tracked, [line(10000, 5), line(20000, 3, "ITEM-2")]);
        await run();
        await makeDue(tracked);

        const stale = shipment(tracked, [
          line(10000, 5),
          line(20000, 3, "ITEM-2"),
          line(30000, -3, "ITEM-2"),
        ]);
        const cancelled = shipment(tracked, [...stale.lines, line(40000, -5)]);
        getShipmentsByNumbers.mockImplementationOnce(async () => {
          await storeAsAnotherRun(tracked, cancelled, {
            action: "close",
            close_reason: "cancelled",
            attempts: 0,
            last_error: null,
            last_checked_at: new Date(),
            final_check_done: false,
          });
          return [stale];
        });

        const result = await run();

        expect(result).toMatchObject({ conflicts: 1, recorded: 0, errors: 0 });
        const stored = await notices(tracked);
        expect(stored.map((notice) => notice.status)).toEqual(["shipped", "cancelled"]);
        expect(await row(tracked)).toMatchObject({
          state: "closed",
          close_reason: "cancelled",
          latest_revision: 2,
        });
      });

      it("leaves an open row due now after a store conflict", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        inBc(tracked, [line(10000, 5), line(20000, 3, "ITEM-2")]);
        await run();
        await makeDue(tracked);

        const revised = shipment(tracked, [
          line(10000, 5),
          line(20000, 3, "ITEM-2"),
          line(30000, -3, "ITEM-2"),
        ]);
        const stale = shipment(tracked, [line(10000, 5), line(20000, 4, "ITEM-2")]);
        getShipmentsByNumbers.mockImplementationOnce(async () => {
          await storeAsAnotherRun(tracked, revised, {
            action: "reschedule",
            next_check_at: at(new Date(), 15 * MINUTE),
            attempts: 0,
            last_error: null,
            last_checked_at: new Date(),
            final_check_done: false,
          });
          return [stale];
        });

        const result = await run();

        expect(result).toMatchObject({ conflicts: 1, recorded: 0 });
        expect((await notices(tracked)).map((notice) => notice.status)).toEqual([
          "shipped",
          "revised",
        ]);
        const due = await row(tracked);
        expect(due).toMatchObject({ state: "open", latest_revision: 2 });
        expect(due.next_check_at.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it("closes a superseded shipment without reading or storing it", async () => {
        const order = await seedOrder("SO-101", null);
        const tracked = await track(order.id, { bcOrderNumber: "SO-100" });
        inBc(tracked, [line(10000, 5)]);

        const result = await run();

        expect(result).toMatchObject({ checked: 1, recorded: 0, errors: 0 });
        expect(await row(tracked)).toMatchObject({ state: "closed", close_reason: "superseded" });
        expect(await notices(tracked)).toHaveLength(0);
        expect(getShipmentsByNumbers).not.toHaveBeenCalled();
      });

      it("backs off an unpairable shipment, then gives up after the window", async () => {
        const logger = getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER);
        const warn = jest.spyOn(logger, "warn");
        const error = jest.spyOn(logger, "error");
        const info = jest.spyOn(logger, "info");
        const order = await seedOrder("SO-100", null);
        const unpairable = await track(order.id, { due: at(new Date(), -2 * MINUTE) });
        const settled = await track(order.id);
        inBc(unpairable, [line(10000, 5), line(20000, -2)]);
        inBc(settled, [line(10000, 1)]);
        const before = Date.now();

        const result = await run();

        expect(result).toMatchObject({
          checked: 2,
          recorded: 1,
          errors: 1,
          status: "completed_with_errors",
        });
        expect(await notices(settled)).toHaveLength(1);
        expect(await notices(unpairable)).toHaveLength(0);
        const backedOff = await row(unpairable);
        expect(backedOff).toMatchObject({ state: "open", attempts: 1, last_error: "unpairable" });
        expect(backedOff.next_check_at.getTime()).toBeGreaterThanOrEqual(before + 15 * MINUTE);
        expect(loggedText(warn)).toContain(unpairable.number);

        await orderIngestion().updateShipmentTrackings({
          id: backedOff.id,
          next_check_at: at(new Date(), -MINUTE),
          recheck_until: at(new Date(), -4 * DAY),
        });
        const final = await run();

        expect(final).toMatchObject({ errors: 1, status: "completed_with_errors" });
        expect(await row(unpairable)).toMatchObject({
          state: "closed",
          close_reason: "gave_up",
          attempts: 2,
          last_error: "unpairable",
        });
        expect(loggedText(error)).toContain(unpairable.number);
        const logged = loggedText(warn, error, info);
        expect(logged).not.toContain(RECEIVER_NAME);
        expect(logged).not.toContain(RECEIVER_STREET);
      });

      it("gives a shipment past its window one final check, then closes it", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id, {
          due: at(new Date(), -2 * DAY),
          recheckUntil: at(new Date(), -DAY),
        });
        inBc(tracked, [line(10000, 2)]);

        const result = await run();

        expect(result).toMatchObject({ checked: 1, recorded: 1, errors: 0 });
        expect((await notices(tracked)).map((notice) => notice.status)).toEqual(["shipped"]);
        expect(await row(tracked)).toMatchObject({
          state: "closed",
          close_reason: "window_ended",
          final_check_done: true,
        });
      });

      it("backs off a shipment BC no longer returns", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);

        const result = await run();

        expect(result).toMatchObject({ errors: 1, status: "completed_with_errors" });
        expect(await row(tracked)).toMatchObject({
          state: "open",
          attempts: 1,
          last_error: "not_returned",
        });
      });

      it("backs off the shipments of a failed BC read with a code", async () => {
        const logger = getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER);
        const warn = jest.spyOn(logger, "warn");
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        getShipmentsByNumbers.mockRejectedValue(new Error(`token rejected for ${RECEIVER_NAME}`));

        const result = await run();

        expect(result).toMatchObject({ errors: 1, status: "completed_with_errors" });
        expect(await row(tracked)).toMatchObject({ attempts: 1, last_error: "bc_error" });
        expect(loggedText(warn)).toContain(`${tracked.number} (BC order SO-100) failed: bc_error`);
        expect(loggedText(warn)).not.toContain(RECEIVER_NAME);
      });

      it("sets the poll back-off on throttling and leaves the rows due and unchanged", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        const due = (await row(tracked)).next_check_at;
        getShipmentsByNumbers.mockRejectedValue(
          new BusinessCentralThrottledError("throttled", null)
        );
        const before = Date.now();

        const result = await run();

        expect(result).toMatchObject({ checked: 0, errors: 0, backlog_due: 1 });
        expect(await row(tracked)).toMatchObject({
          state: "open",
          attempts: 0,
          next_check_at: due,
        });
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.bc_backoff_until!.getTime()).toBeGreaterThanOrEqual(before + MINUTE);
      });

      it("makes no BC request after the deadline", async () => {
        const order = await seedOrder("SO-100", null);
        const tracked = await track(order.id);
        inBc(tracked, [line(10000, 5)]);

        const result = await run(at(new Date(), -MINUTE));

        expect(getShipmentsByNumbers).not.toHaveBeenCalled();
        expect(result).toMatchObject({ checked: 0, backlog_due: 1 });
        expect(await row(tracked)).toMatchObject({ state: "open", attempts: 0 });
      });

      it("checks the 200 oldest of 250 due shipments, the rest next run", async () => {
        const order = await seedOrder("SO-100", null);
        const now = new Date();
        const all: Tracked[] = [];
        for (let index = 0; index < 250; index += 1) {
          const tracked = await track(order.id, { due: at(now, -(300 - index) * MINUTE) });
          inBc(tracked, [line(10000, 1)]);
          all.push(tracked);
        }

        const first = await run();

        expect(first).toMatchObject({ checked: 200, recorded: 200, backlog_due: 50 });
        expect(first.oldest_due_age_ms).toBeGreaterThanOrEqual(50 * MINUTE);
        const requested = getShipmentsByNumbers.mock.calls.map(([numbers]) => numbers);
        expect(requested.every((numbers) => numbers.length <= 20)).toBe(true);
        expect(requested.flat().sort()).toEqual(all.slice(0, 200).map((t) => t.number).sort());

        const second = await run();

        expect(second).toMatchObject({ checked: 50, recorded: 50, backlog_due: 0 });
        expect(second.oldest_due_age_ms).toBe(0);
      });
    });
  },
});
