import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import {
  BusinessCentralThrottledError,
  ShipmentReadDeadlineError,
} from "../../../src/modules/business-central/shipment-reads";
import type {
  BCShipmentHeader,
  BCShipmentWindow,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type {
  ShipmentTrackingDiscovery,
} from "../../../src/modules/order-ingestion/shipment-notice-storage";
import {
  discoverShipmentsWorkflow,
} from "../../../src/workflows/shipment-notice/workflows/discover-shipments";

jest.setTimeout(120 * 1000);

const MINUTE = 60 * 1000;
const at = (base: Date, offsetMs: number): Date => new Date(base.getTime() + offsetMs);
const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Business Central's shipment reads over an in-memory list of headers, honouring the (after,
 * until] window the way BC filters `lastModifiedDateTime`. The HTTP side (paging, filters) is
 * covered by the adapter's own spec.
 */
class FakeShipmentHeaders {
  headers: BCShipmentHeader[] = [];
  listFailures = 0;

  inWindow(window: BCShipmentWindow): BCShipmentHeader[] {
    return this.headers
      .filter((header) => {
        const modified = new Date(header.lastModifiedDateTime).getTime();
        return modified > window.after.getTime() && modified <= window.until.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.lastModifiedDateTime).getTime() - new Date(b.lastModifiedDateTime).getTime()
      );
  }
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("discoverShipmentsWorkflow", () => {
      let fake: FakeShipmentHeaders;
      let countShipments: jest.SpyInstance;
      let listShipmentHeaders: jest.SpyInstance;
      let shipmentCounter = 0;

      const orderIngestion = (): OrderIngestionModuleService =>
        getContainer().resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

      beforeEach(() => {
        fake = new FakeShipmentHeaders();
        const bc = getContainer().resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
        countShipments = jest
          .spyOn(bc, "countShipments")
          .mockImplementation(async (window) => fake.inWindow(window).length);
        listShipmentHeaders = jest
          .spyOn(bc, "listShipmentHeaders")
          .mockImplementation(async (window) => {
            if (fake.listFailures > 0) {
              fake.listFailures -= 1;
              throw new Error("Business Central shipment read did not complete (page 2)");
            }
            return fake.inWindow(window);
          });
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      async function seedApiOrder(options: {
        customerNumber: string;
        externalOrderNumber: string;
        bcOrderNumber: string;
      }) {
        const container = getContainer();
        const companies = container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orders = container.resolve<IOrderModuleService>(Modules.ORDER);

        const company = await companies.createCompanies({
          name: `Shipment Co ${options.customerNumber}`,
          phone: "+4500000000",
          email: `shipments-${options.customerNumber}@example.com`,
          address: null,
          city: null,
          state: null,
          zip: null,
          country: "dk",
          logo_url: null,
          currency_code: "dkk",
          business_central_customer_number: options.customerNumber,
          spending_limit_reset_frequency: null,
        });
        const order = await orders.createOrders({
          currency_code: "dkk",
          metadata: {
            company_id: company.id,
            [BC_INTEGRATION_STATE_METADATA_KEY]: {
              ...createInitialBcIntegrationState("2026-10-19T08:00:00.000Z"),
              status: "sent",
              bc_order_id: `bc-${options.bcOrderNumber}`,
              bc_order_number: options.bcOrderNumber,
            },
          },
        });
        await orderIngestion().createOrderExternalReferences({
          company_id: company.id,
          order_id: order.id,
          external_order_number: options.externalOrderNumber,
        });
        return { company, order };
      }

      function header(
        lastModified: Date,
        overrides: Partial<BCShipmentHeader> = {}
      ): BCShipmentHeader {
        shipmentCounter += 1;
        return {
          id: `bc-shp-${shipmentCounter}`,
          number: `SS-${shipmentCounter}`,
          orderNumber: "SO-100",
          externalDocumentNumber: "METZ-1",
          customerNumber: "C-100",
          postingDate: utcDay(new Date()),
          lastModifiedDateTime: lastModified.toISOString(),
          ...overrides,
        };
      }

      async function startPollStateAt(goLive: Date) {
        await orderIngestion().initializeShipmentPollState(goLive);
      }

      async function trackingRows() {
        return orderIngestion().listShipmentTrackings({}, { take: null });
      }

      async function run(deadline = at(new Date(), 4 * MINUTE)) {
        const { result } = await discoverShipmentsWorkflow(getContainer()).run({
          input: { deadline },
        });
        return result;
      }

      it("initializes the poll state on the first run and makes no BC call", async () => {
        const before = Date.now();

        const result = await run();

        const state = await orderIngestion().retrieveShipmentPollState();
        expect(state).not.toBeNull();
        expect(state!.go_live_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
        expect(state!.lead_cursor).toEqual(state!.go_live_at);
        expect(state!.trail_cursor).toEqual(state!.go_live_at);
        expect(countShipments).not.toHaveBeenCalled();
        expect(listShipmentHeaders).not.toHaveBeenCalled();
        expect(result).toMatchObject({ headers: 0, matched: 0, tracked: 0 });
      });

      it("tracks a header behind 1,000 tracked ones and advances both cursors", async () => {
        const now = new Date();
        const goLive = at(now, -180 * MINUTE);
        const { company, order } = await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await startPollStateAt(goLive);

        const tracked: BCShipmentHeader[] = [];
        for (let index = 0; index < 1000; index += 1) {
          tracked.push(header(at(goLive, 5 * MINUTE + index * 1000)));
        }
        const discoveries: ShipmentTrackingDiscovery[] = tracked.map((row) => ({
          bc_shipment_id: row.id,
          shipment_number: row.number,
          bc_order_number: "SO-100",
          posting_date: row.postingDate!,
          company_id: company.id,
          order_id: order.id,
          external_order_number: "METZ-1",
          next_check_at: at(now, -60 * MINUTE),
          recheck_until: at(now, 14 * 24 * 60 * MINUTE),
        }));
        await orderIngestion().upsertShipmentTracking(discoveries);
        const newer = header(at(now, -20 * MINUTE));
        fake.headers = [...tracked, newer];

        await run();
        let rows = await trackingRows();
        if (!rows.some((row) => row.bc_shipment_id === newer.id)) {
          await run();
          rows = await trackingRows();
        }

        expect(rows).toHaveLength(1001);
        const newRow = rows.find((row) => row.bc_shipment_id === newer.id);
        expect(newRow).toMatchObject({ state: "open", order_id: order.id });
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor.getTime()).toBeGreaterThanOrEqual(
          new Date(newer.lastModifiedDateTime).getTime()
        );
        expect(state.trail_cursor.getTime()).toBeGreaterThanOrEqual(
          new Date(tracked[999].lastModifiedDateTime).getTime()
        );
      });

      it("reads a tie group over a page and the budget whole, then passes it", async () => {
        const now = new Date();
        const goLive = at(now, -180 * MINUTE);
        await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await startPollStateAt(goLive);
        // Inside the lead window only, so the trail scan does not read it too.
        const tie = at(now, -30 * MINUTE);
        const others = Array.from({ length: 1000 }, () =>
          header(tie, { customerNumber: "C-NOT-AN-API-CUSTOMER" })
        );
        const ours = [header(tie), header(tie)];
        fake.headers = [...others, ...ours];

        const result = await run();

        const rows = await trackingRows();
        expect(rows.map((row) => row.bc_shipment_id).sort()).toEqual(
          ours.map((row) => row.id).sort()
        );
        const tieReads = listShipmentHeaders.mock.calls.filter(
          ([window]: [BCShipmentWindow]) => window.until.getTime() === tie.getTime()
        );
        expect(tieReads).toHaveLength(1);
        expect(tieReads[0][0].after.getTime()).toBe(tie.getTime() - 1);
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor.getTime()).toBeGreaterThan(tie.getTime());
        expect(result.complete).toBe(true);
      });

      it("keeps the cursor when a window fails part-way; a rerun tracks every row", async () => {
        const now = new Date();
        const goLive = at(now, -60 * MINUTE);
        await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await startPollStateAt(goLive);
        fake.headers = [header(at(now, -40 * MINUTE)), header(at(now, -30 * MINUTE))];
        fake.listFailures = 1;

        await expect(run()).rejects.toMatchObject({ message: expect.stringContaining("page 2") });

        let state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor).toEqual(goLive);
        expect(state.trail_cursor).toEqual(goLive);
        expect(await trackingRows()).toHaveLength(0);

        await run();

        expect((await trackingRows()).map((row) => row.bc_shipment_id).sort()).toEqual(
          fake.headers.map((row) => row.id).sort()
        );
        state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor.getTime()).toBeGreaterThan(goLive.getTime());
      });

      it("preserves an incomplete expired window and retries it successfully", async () => {
        const now = new Date();
        const goLive = at(now, -60 * MINUTE);
        const deadline = at(now, 4 * MINUTE);
        await seedApiOrder({ customerNumber: "C-100", externalOrderNumber: "METZ-1", bcOrderNumber: "SO-100" });
        await startPollStateAt(goLive);
        fake.headers = [header(at(now, -30 * MINUTE))];
        listShipmentHeaders.mockImplementationOnce(async (_window, receivedDeadline) => {
          expect(receivedDeadline).toBe(deadline.getTime());
          jest.spyOn(Date, "now").mockReturnValue(deadline.getTime());
          throw new ShipmentReadDeadlineError();
        });

        const incomplete = await run(deadline);

        expect(incomplete).toMatchObject({ complete: false, tracked: 0 });
        expect(await trackingRows()).toHaveLength(0);
        expect(await orderIngestion().retrieveShipmentPollState()).toMatchObject({
          lead_cursor: goLive, trail_cursor: goLive, bc_backoff_until: null,
        });
        jest.spyOn(Date, "now").mockRestore();
        const complete = await run();
        expect(complete.complete).toBe(true);
        expect(await trackingRows()).toHaveLength(1);
        expect((await orderIngestion().retrieveShipmentPollState())!.lead_cursor.getTime())
          .toBeGreaterThan(goLive.getTime());
      });

      it("commits a complete final window returned after the deadline", async () => {
        const now = new Date();
        const goLive = at(now, -60 * MINUTE);
        const deadline = at(now, 4 * MINUTE);
        await seedApiOrder({ customerNumber: "C-100", externalOrderNumber: "METZ-1", bcOrderNumber: "SO-100" });
        await startPollStateAt(goLive);
        fake.headers = [header(at(now, -30 * MINUTE))];
        listShipmentHeaders.mockImplementationOnce(async (window, receivedDeadline) => {
          expect(receivedDeadline).toBe(deadline.getTime());
          jest.spyOn(Date, "now").mockReturnValue(deadline.getTime() + 1);
          return fake.inWindow(window);
        });

        await run(deadline);

        expect(await trackingRows()).toHaveLength(1);
        expect((await orderIngestion().retrieveShipmentPollState())!.lead_cursor.getTime())
          .toBeGreaterThan(goLive.getTime());
      });

      it("tracks only shipments of the API order under its current BC order number", async () => {
        const now = new Date();
        const goLive = at(now, -60 * MINUTE);
        const { company, order } = await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await seedApiOrder({
          customerNumber: "C-200",
          externalOrderNumber: "OTHER-1",
          bcOrderNumber: "SO-200",
        });
        await startPollStateAt(goLive);
        const modified = at(now, -30 * MINUTE);
        const matching = header(modified);
        fake.headers = [
          header(modified, { externalDocumentNumber: "WEB-NOT-API" }),
          header(modified, { orderNumber: "SO-099" }),
          header(modified, { externalDocumentNumber: "OTHER-1", orderNumber: "SO-200" }),
          header(modified, { postingDate: "2020-01-01" }),
          matching,
        ];

        const result = await run();

        const rows = await trackingRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          bc_shipment_id: matching.id,
          shipment_number: matching.number,
          bc_order_number: "SO-100",
          company_id: company.id,
          order_id: order.id,
          external_order_number: "METZ-1",
          state: "open",
          latest_revision: 0,
        });
        expect(rows[0].next_check_at).toEqual(at(modified, 15 * MINUTE));
        expect(result).toMatchObject({ headers: 5, matched: 1, tracked: 1 });
      });

      it("moves an open row's due time earlier for a newer header, never later", async () => {
        const now = new Date();
        const goLive = at(now, -120 * MINUTE);
        const { company, order } = await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await startPollStateAt(goLive);
        const backedOff = header(at(now, -30 * MINUTE));
        const recent = header(at(now, -30 * MINUTE));
        const existing = (row: BCShipmentHeader, due: Date): ShipmentTrackingDiscovery => ({
          bc_shipment_id: row.id,
          shipment_number: row.number,
          bc_order_number: "SO-100",
          posting_date: row.postingDate!,
          company_id: company.id,
          order_id: order.id,
          external_order_number: "METZ-1",
          next_check_at: due,
          recheck_until: at(now, 14 * 24 * 60 * MINUTE),
        });
        const farFuture = at(now, 4 * 60 * MINUTE);
        const soon = at(now, -40 * MINUTE);
        await orderIngestion().upsertShipmentTracking([
          existing(backedOff, farFuture),
          existing(recent, soon),
        ]);
        fake.headers = [backedOff, recent];

        await run();

        const rows = await trackingRows();
        const byId = new Map(rows.map((row) => [row.bc_shipment_id, row]));
        expect(byId.get(backedOff.id)!.next_check_at).toEqual(at(now, -15 * MINUTE));
        expect(byId.get(recent.id)!.next_check_at).toEqual(soon);
      });

      it("does not advance the cursor when the deadline is reached mid-window", async () => {
        const now = new Date();
        const goLive = at(now, -60 * MINUTE);
        await seedApiOrder({
          customerNumber: "C-100",
          externalOrderNumber: "METZ-1",
          bcOrderNumber: "SO-100",
        });
        await startPollStateAt(goLive);
        fake.headers = [header(at(now, -30 * MINUTE))];
        const deadline = at(now, 4 * MINUTE);
        countShipments.mockImplementation(async (window: BCShipmentWindow) => {
          // The run's clock passes the deadline while the window is being sized.
          jest.spyOn(Date, "now").mockReturnValue(deadline.getTime() + 1);
          return fake.inWindow(window).length;
        });

        const result = await run(deadline);

        expect(countShipments).toHaveBeenCalledTimes(1);
        expect(listShipmentHeaders).not.toHaveBeenCalled();
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor).toEqual(goLive);
        expect(state.trail_cursor).toEqual(goLive);
        expect(await trackingRows()).toHaveLength(0);
        expect(result.complete).toBe(false);
      });

      it("backs off at least a minute on throttling and makes no further BC call", async () => {
        const now = new Date();
        const goLive = at(now, -120 * MINUTE);
        await startPollStateAt(goLive);
        fake.headers = [header(at(now, -30 * MINUTE))];
        countShipments.mockRejectedValue(new BusinessCentralThrottledError("throttled", null));

        const result = await run();

        expect(countShipments).toHaveBeenCalledTimes(1);
        expect(listShipmentHeaders).not.toHaveBeenCalled();
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.bc_backoff_until!.getTime()).toBeGreaterThanOrEqual(now.getTime() + MINUTE);
        expect(state.lead_cursor).toEqual(goLive);
        expect(state.trail_cursor).toEqual(goLive);
        expect(result.complete).toBe(false);
      });

      it("uses BC's Retry-After for the back-off when it is longer than a minute", async () => {
        const now = new Date();
        await startPollStateAt(at(now, -120 * MINUTE));
        countShipments.mockRejectedValue(new BusinessCentralThrottledError("throttled", 600));

        await run();

        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.bc_backoff_until!.getTime()).toBeGreaterThanOrEqual(
          now.getTime() + 600 * 1000
        );
      });

      it("reports the cursor lags after the run", async () => {
        const now = new Date();
        await startPollStateAt(at(now, -120 * MINUTE));

        const result = await run();

        expect(result.complete).toBe(true);
        expect(result.lead_lag_ms).toBeGreaterThanOrEqual(15 * MINUTE);
        expect(result.lead_lag_ms).toBeLessThan(16 * MINUTE);
        expect(result.trail_lag_ms).toBeGreaterThanOrEqual(45 * MINUTE);
        expect(result.trail_lag_ms).toBeLessThan(46 * MINUTE);
      });
    });
  },
});
