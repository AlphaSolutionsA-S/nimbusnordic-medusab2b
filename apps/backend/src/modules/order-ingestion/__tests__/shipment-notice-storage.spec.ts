import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaError } from "@medusajs/framework/utils";
import { ORDER_INGESTION_MODULE } from "../index";
import OrderIngestionModuleService from "../service";
import { shipmentNoticeEnvelopeExample } from "../__fixtures__/shipment-notice-fixtures";
import { ShipmentNoticePayloadSchema } from "../shipment-notice-contract";
import type {
  ShipmentTrackingDiscovery,
  StoreShipmentNoticeInput,
  StoreShipmentNoticeResult,
} from "../shipment-notice-storage";

jest.setTimeout(60000);

const NOW = new Date("2026-10-20T08:00:00.000Z");
const minutes = (date: Date, count: number): Date => new Date(date.getTime() + count * 60_000);

const {
  cursor: _cursor,
  previous_cursor: _previousCursor,
  recorded_at: _recordedAt,
  revision: _revision,
  status: _status,
  ...examplePayloadFields
} = shipmentNoticeEnvelopeExample.shipment_notices[0];
const PAYLOAD = ShipmentNoticePayloadSchema.parse(examplePayloadFields);

function discovery(overrides: Partial<ShipmentTrackingDiscovery> = {}): ShipmentTrackingDiscovery {
  const bcShipmentId = overrides.bc_shipment_id ?? "bc-ship-1";
  return {
    bc_shipment_id: bcShipmentId,
    shipment_number: `S-${bcShipmentId}`,
    bc_order_number: "SO-104233",
    posting_date: "2026-10-20",
    company_id: "comp_A",
    order_id: "order_A",
    external_order_number: "PO-778812",
    next_check_at: minutes(NOW, 15),
    recheck_until: new Date("2026-11-03T23:59:59.999Z"),
    ...overrides,
  };
}

function notice(overrides: Partial<StoreShipmentNoticeInput> = {}): StoreShipmentNoticeInput {
  return {
    bc_shipment_id: "bc-ship-1",
    expected_revision: 0,
    company_id: "comp_A",
    order_id: "order_A",
    external_order_number: "PO-778812",
    bc_order_number: "SO-104233",
    shipment_number: "S-bc-ship-1",
    shipment_date: "2026-10-20",
    bc_last_modified_at: NOW,
    status: "shipped",
    content_hash: "hash-1",
    payload: PAYLOAD,
    tracking: {
      action: "reschedule",
      next_check_at: minutes(NOW, 15),
      attempts: 0,
      last_error: null,
      last_checked_at: NOW,
      final_check_done: false,
    },
    ...overrides,
  };
}

moduleIntegrationTestRunner<OrderIngestionModuleService>({
  moduleName: ORDER_INGESTION_MODULE,
  resolve: "./src/modules/order-ingestion",
  testSuite: ({ service, MikroOrmWrapper }) => {
    // Runs on the test ORM's own pool, outside any connection the service or a writer uses.
    const rawQuery = async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      MikroOrmWrapper.forkManager().execute<T[]>(sql, params);

    const counter = async (): Promise<number> =>
      (await service.retrieveShipmentPollState())?.last_sequence ?? -1;

    const noticeCount = async (): Promise<number> =>
      (await rawQuery<{ n: number }>("SELECT count(*)::int AS n FROM shipment_notice"))[0].n;

    const tracking = async (bcShipmentId: string) =>
      (await service.listShipmentTrackings({ bc_shipment_id: bcShipmentId }))[0];

    describe("poll state", () => {
      it("reads null before the first run, then initializes once with go-live and both cursors at now", async () => {
        expect(await service.retrieveShipmentPollState()).toBeNull();

        const first = await service.initializeShipmentPollState(NOW);
        expect(first.created).toBe(true);
        expect(first.state).toEqual({
          last_sequence: 0,
          lead_cursor: NOW,
          trail_cursor: NOW,
          go_live_at: NOW,
          bc_backoff_until: null,
        });

        const second = await service.initializeShipmentPollState(minutes(NOW, 60));
        expect(second.created).toBe(false);
        expect(second.state.go_live_at).toEqual(NOW);
      });

      it("creates exactly one state row when two first-use initializations race", async () => {
        const results = await Promise.all([
          service.initializeShipmentPollState(NOW),
          service.initializeShipmentPollState(minutes(NOW, 1)),
        ]);

        expect(results.filter((result) => result.created)).toHaveLength(1);
        const rows = await rawQuery<{ n: number }>(
          "SELECT count(*)::int AS n FROM shipment_notice_state"
        );
        expect(rows[0].n).toBe(1);
      });

      it("sets each scan cursor and the BC back-off independently", async () => {
        await service.initializeShipmentPollState(NOW);

        await service.setShipmentPollCursor("lead", minutes(NOW, 10));
        await service.setShipmentPollCursor("trail", minutes(NOW, -20));
        await service.setShipmentPollBackoff(minutes(NOW, 5));

        expect(await service.retrieveShipmentPollState()).toEqual({
          last_sequence: 0,
          lead_cursor: minutes(NOW, 10),
          trail_cursor: minutes(NOW, -20),
          go_live_at: NOW,
          bc_backoff_until: minutes(NOW, 5),
        });

        await service.setShipmentPollBackoff(null);
        expect((await service.retrieveShipmentPollState())?.bc_backoff_until).toBeNull();
      });

      it("refuses to set a cursor before the state row exists", async () => {
        await expect(service.setShipmentPollCursor("lead", NOW)).rejects.toMatchObject({
          type: MedusaError.Types.NOT_FOUND,
        });
      });
    });

    describe("storing a revision against an expected revision", () => {
      beforeEach(async () => {
        await service.initializeShipmentPollState(NOW);
        await service.upsertShipmentTracking([discovery()]);
      });

      it("stores revision 1 with the next cursor and updates the tracking row in the same transaction", async () => {
        const result = await service.storeShipmentNotice(notice());

        expect(result).toEqual({ outcome: "stored", sequence: 1, revision: 1 });
        expect(await counter()).toBe(1);

        const [row] = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 0,
          limit: 10,
        });
        expect(row).toMatchObject({
          sequence: 1,
          previous_sequence: null,
          revision: 1,
          status: "shipped",
          bc_shipment_id: "bc-ship-1",
          order_id: "order_A",
          shipment_date: "2026-10-20",
          bc_last_modified_at: NOW,
          payload: PAYLOAD,
        });
        expect(row.created_at).toBeInstanceOf(Date);

        expect(await tracking("bc-ship-1")).toMatchObject({
          latest_revision: 1,
          state: "open",
          next_check_at: minutes(NOW, 15),
          last_checked_at: NOW,
        });
      });

      it("stores a changed hash as revision N+1 pointing at N's cursor; an equal hash is unchanged and takes no cursor", async () => {
        await service.storeShipmentNotice(notice());

        const revised = await service.storeShipmentNotice(
          notice({ expected_revision: 1, status: "revised", content_hash: "hash-2" })
        );
        expect(revised).toEqual({ outcome: "stored", sequence: 2, revision: 2 });

        const unchanged = await service.storeShipmentNotice(
          notice({ expected_revision: 2, status: "revised", content_hash: "hash-2" })
        );
        expect(unchanged).toEqual({ outcome: "unchanged", revision: 2 });

        const rows = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 0,
          limit: 10,
        });
        expect(rows.map((row) => [row.sequence, row.previous_sequence, row.revision])).toEqual([
          [1, null, 1],
          [2, 1, 2],
        ]);
        expect(await counter()).toBe(2);
        expect((await tracking("bc-ship-1")).latest_revision).toBe(2);
      });

      it("returns conflict for a stale worker: nothing inserted, counter and tracking unchanged", async () => {
        await service.storeShipmentNotice(notice());
        await service.storeShipmentNotice(
          notice({
            expected_revision: 1,
            status: "cancelled",
            content_hash: "hash-cancelled",
            tracking: {
              action: "close",
              close_reason: "cancelled",
              attempts: 0,
              last_error: null,
              last_checked_at: NOW,
              final_check_done: false,
            },
          })
        );
        const trackingBefore = await tracking("bc-ship-1");

        const stale = await service.storeShipmentNotice(
          notice({ expected_revision: 1, status: "revised", content_hash: "hash-positive" })
        );

        expect(stale).toEqual({ outcome: "conflict", latest_revision: 2 });
        expect(await noticeCount()).toBe(2);
        expect(await counter()).toBe(2);
        expect(await tracking("bc-ship-1")).toEqual(trackingBefore);
      });

      it("closes the tracking row when the stored schedule says so", async () => {
        await service.storeShipmentNotice(notice());
        await service.storeShipmentNotice(
          notice({
            expected_revision: 1,
            status: "cancelled",
            content_hash: "hash-cancelled",
            tracking: {
              action: "close",
              close_reason: "cancelled",
              attempts: 0,
              last_error: null,
              last_checked_at: NOW,
              final_check_done: false,
            },
          })
        );

        const row = await tracking("bc-ship-1");
        expect(row).toMatchObject({ state: "closed", close_reason: "cancelled", latest_revision: 2 });
        expect(row.closed_at).toBeInstanceOf(Date);
      });

      it("stores the same content once when two workers store it at the same time", async () => {
        const results = await Promise.all([
          service.storeShipmentNotice(notice()),
          service.storeShipmentNotice(notice()),
        ]);

        expect(results.filter((result) => result.outcome === "stored")).toHaveLength(1);
        expect(results.filter((result) => result.outcome !== "stored")).toHaveLength(1);
        expect(await noticeCount()).toBe(1);
        expect(await counter()).toBe(1);
      });

      it("rejects a direct duplicate (bc_shipment_id, revision) insert", async () => {
        await service.storeShipmentNotice(notice());

        await expect(
          service.createShipmentNotices({
            sequence: 99,
            previous_sequence: null,
            bc_shipment_id: "bc-ship-1",
            revision: 1,
            status: "shipped",
            content_hash: "other",
            company_id: "comp_A",
            order_id: "order_A",
            external_order_number: "PO-778812",
            bc_order_number: "SO-104233",
            shipment_number: "S-bc-ship-1",
            shipment_date: "2026-10-20",
            bc_last_modified_at: NOW,
            payload: PAYLOAD,
          })
        ).rejects.toBeDefined();
        expect(await noticeCount()).toBe(1);
      });

      it("refuses a store without company or order, and one without a tracking row, inserting nothing", async () => {
        await expect(service.storeShipmentNotice(notice({ company_id: "" }))).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
        });
        await expect(service.storeShipmentNotice(notice({ order_id: "" }))).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
        });
        await expect(
          service.storeShipmentNotice(notice({ bc_shipment_id: "not-tracked" }))
        ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND });

        expect(await noticeCount()).toBe(0);
        expect(await counter()).toBe(0);
      });
    });

    describe("visibility order of concurrent stores", () => {
      type HeldStore = {
        stored: Promise<StoreShipmentNoticeResult>;
        committed: Promise<void>;
        release: () => void;
        isStored: () => boolean;
      };

      // Runs a store inside a transaction on its own connection and keeps it open until released.
      function heldStore(input: StoreShipmentNoticeInput): HeldStore {
        let release: () => void = () => undefined;
        const released = new Promise<void>((resolve) => (release = resolve));
        let done = false;
        let resolveStored: (result: StoreShipmentNoticeResult) => void = () => undefined;
        let rejectStored: (error: unknown) => void = () => undefined;
        const stored = new Promise<StoreShipmentNoticeResult>((resolve, reject) => {
          resolveStored = resolve;
          rejectStored = reject;
        });
        const committed = MikroOrmWrapper.forkManager().transactional(async (manager) => {
          try {
            const result = await service.storeShipmentNotice(input, { transactionManager: manager });
            done = true;
            resolveStored(result);
          } catch (error) {
            rejectStored(error);
            throw error;
          }
          await released;
        });
        return { stored, committed, release, isStored: () => done };
      }

      async function waitUntilAWriterWaitsOnALock(): Promise<void> {
        for (let attempt = 0; attempt < 250; attempt++) {
          const [{ n }] = await rawQuery<{ n: number }>(
            `SELECT count(*)::int AS n FROM pg_stat_activity
             WHERE datname = current_database() AND wait_event_type = 'Lock'`
          );
          if (n > 0) {
            return;
          }
          await new Promise((resolve) => setImmediate(resolve));
        }
        throw new Error("The second writer never waited on the counter row");
      }

      const readerSequences = async (): Promise<number[]> =>
        (
          await service.listCompanyShipmentNotices({ company_id: "comp_A", after: 0, limit: 10 })
        ).map((row) => row.sequence);

      it("commits in cursor order: a reader never sees N+1 before N", async () => {
        await service.initializeShipmentPollState(NOW);
        await service.upsertShipmentTracking([
          discovery({ bc_shipment_id: "ship-A" }),
          discovery({ bc_shipment_id: "ship-B" }),
        ]);

        const writerA = heldStore(notice({ bc_shipment_id: "ship-A" }));
        expect(await writerA.stored).toEqual({ outcome: "stored", sequence: 1, revision: 1 });

        const writerB = heldStore(notice({ bc_shipment_id: "ship-B" }));
        await waitUntilAWriterWaitsOnALock();
        expect(writerB.isStored()).toBe(false);
        expect(await readerSequences()).toEqual([]);

        writerA.release();
        await writerA.committed;
        expect(await writerB.stored).toEqual({ outcome: "stored", sequence: 2, revision: 1 });
        expect(await readerSequences()).toEqual([1]);

        writerB.release();
        await writerB.committed;
        expect(await readerSequences()).toEqual([1, 2]);
      });
    });

    describe("tracking", () => {
      it("inserts discovered shipments open, and for an open row only ever moves the due time earlier", async () => {
        const inserted = await service.upsertShipmentTracking([discovery()]);
        expect(inserted).toEqual({ inserted: 1, updated: 0 });
        expect(await tracking("bc-ship-1")).toMatchObject({
          state: "open",
          latest_revision: 0,
          attempts: 0,
          final_check_done: false,
          close_reason: null,
          next_check_at: minutes(NOW, 15),
        });

        await service.upsertShipmentTracking([discovery({ next_check_at: minutes(NOW, 60) })]);
        expect((await tracking("bc-ship-1")).next_check_at).toEqual(minutes(NOW, 15));

        const earlier = await service.upsertShipmentTracking([
          discovery({ next_check_at: minutes(NOW, 5) }),
        ]);
        expect(earlier).toEqual({ inserted: 0, updated: 1 });
        expect((await tracking("bc-ship-1")).next_check_at).toEqual(minutes(NOW, 5));
      });

      it("leaves a closed row untouched when discovery sees it again", async () => {
        await service.upsertShipmentTracking([discovery()]);
        await service.closeShipmentTracking("bc-ship-1", {
          close_reason: "window_ended",
          attempts: 0,
          last_error: null,
          last_checked_at: NOW,
          final_check_done: true,
        });
        const before = await tracking("bc-ship-1");

        const result = await service.upsertShipmentTracking([
          discovery({ next_check_at: minutes(NOW, -30) }),
        ]);

        expect(result).toEqual({ inserted: 0, updated: 0 });
        expect(await tracking("bc-ship-1")).toEqual(before);
      });

      it("selects due open rows oldest first up to the limit, never closed or not-yet-due rows", async () => {
        await service.upsertShipmentTracking([
          discovery({ bc_shipment_id: "due-late", next_check_at: minutes(NOW, -5) }),
          discovery({ bc_shipment_id: "due-early", next_check_at: minutes(NOW, -50) }),
          discovery({ bc_shipment_id: "due-mid", next_check_at: minutes(NOW, -20) }),
          discovery({ bc_shipment_id: "due-now", next_check_at: NOW }),
          discovery({ bc_shipment_id: "closed", next_check_at: minutes(NOW, -90) }),
          discovery({ bc_shipment_id: "future", next_check_at: minutes(NOW, 1) }),
        ]);
        await service.closeShipmentTracking("closed", {
          close_reason: "superseded",
          attempts: 0,
          last_error: null,
          last_checked_at: null,
          final_check_done: false,
        });

        const firstThree = await service.listDueShipmentTracking({ now: NOW, limit: 3 });
        expect(firstThree.map((row) => row.bc_shipment_id)).toEqual([
          "due-early",
          "due-mid",
          "due-late",
        ]);

        const all = await service.listDueShipmentTracking({ now: NOW, limit: 200 });
        expect(all.map((row) => row.bc_shipment_id)).toEqual([
          "due-early",
          "due-mid",
          "due-late",
          "due-now",
        ]);
      });

      it("reschedules an open row and closes it with a reason and closed_at", async () => {
        await service.upsertShipmentTracking([discovery()]);

        expect(
          await service.rescheduleShipmentTracking("bc-ship-1", {
            next_check_at: minutes(NOW, 60),
            attempts: 2,
            last_error: "bc_not_returned",
            last_checked_at: null,
            final_check_done: false,
          })
        ).toBe(true);
        expect(await tracking("bc-ship-1")).toMatchObject({
          state: "open",
          next_check_at: minutes(NOW, 60),
          attempts: 2,
          last_error: "bc_not_returned",
          last_checked_at: null,
        });

        expect(
          await service.closeShipmentTracking("bc-ship-1", {
            close_reason: "gave_up",
            attempts: 3,
            last_error: "bc_not_returned",
            last_checked_at: null,
            final_check_done: false,
          })
        ).toBe(true);
        const closed = await tracking("bc-ship-1");
        expect(closed).toMatchObject({ state: "closed", close_reason: "gave_up", attempts: 3 });
        expect(closed.closed_at).toBeInstanceOf(Date);

        expect(
          await service.rescheduleShipmentTracking("bc-ship-1", {
            next_check_at: NOW,
            attempts: 0,
            last_error: null,
            last_checked_at: NOW,
            final_check_done: false,
          })
        ).toBe(false);
        expect((await tracking("bc-ship-1")).state).toBe("closed");
      });

      it("lists rows closed gave_up newest first, paged, with the total", async () => {
        const giveUp = {
          close_reason: "gave_up" as const,
          attempts: 5,
          last_error: "bc_not_returned",
          last_checked_at: null,
          final_check_done: false,
        };
        await service.upsertShipmentTracking([
          discovery({ bc_shipment_id: "g1" }),
          discovery({ bc_shipment_id: "g2" }),
          discovery({ bc_shipment_id: "g3" }),
          discovery({ bc_shipment_id: "other" }),
          discovery({ bc_shipment_id: "open" }),
        ]);
        await service.closeShipmentTracking("g1", giveUp);
        await service.closeShipmentTracking("g2", giveUp);
        await service.closeShipmentTracking("g3", giveUp);
        await service.closeShipmentTracking("other", { ...giveUp, close_reason: "window_ended" });

        const firstPage = await service.listGaveUpShipmentTracking({ limit: 2, offset: 0 });
        expect(firstPage.count).toBe(3);
        expect(firstPage.rows.map((row) => row.bc_shipment_id)).toEqual(["g3", "g2"]);

        const secondPage = await service.listGaveUpShipmentTracking({ limit: 2, offset: 2 });
        expect(secondPage.rows.map((row) => row.bc_shipment_id)).toEqual(["g1"]);
      });

      it("reopens a gave_up row as open, due now, attempts 0, recording who and when", async () => {
        await service.upsertShipmentTracking([discovery()]);
        await service.closeShipmentTracking("bc-ship-1", {
          close_reason: "gave_up",
          attempts: 7,
          last_error: "bc_not_returned",
          last_checked_at: null,
          final_check_done: false,
        });
        const { id } = await tracking("bc-ship-1");
        const before = new Date();

        const reopened = await service.reopenShipmentTracking(id, "user_admin_1");

        const after = new Date();
        expect(reopened).toMatchObject({
          id,
          state: "open",
          close_reason: null,
          closed_at: null,
          attempts: 0,
          reopened_by: "user_admin_1",
        });
        for (const value of [reopened.next_check_at, reopened.reopened_at]) {
          expect(value).toBeInstanceOf(Date);
          expect((value as Date).getTime()).toBeGreaterThanOrEqual(before.getTime() - 5_000);
          expect((value as Date).getTime()).toBeLessThanOrEqual(after.getTime() + 5_000);
        }
        expect(await service.listDueShipmentTracking({ now: after, limit: 10 })).toHaveLength(1);
      });

      it("refuses to reopen a row that is open or closed for another reason, and an unknown id", async () => {
        await service.upsertShipmentTracking([
          discovery({ bc_shipment_id: "still-open" }),
          discovery({ bc_shipment_id: "cancelled" }),
        ]);
        await service.closeShipmentTracking("cancelled", {
          close_reason: "cancelled",
          attempts: 0,
          last_error: null,
          last_checked_at: NOW,
          final_check_done: false,
        });
        const open = await tracking("still-open");
        const cancelled = await tracking("cancelled");

        await expect(service.reopenShipmentTracking(open.id, "user_1")).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
        });
        await expect(service.reopenShipmentTracking(cancelled.id, "user_1")).rejects.toMatchObject({
          type: MedusaError.Types.NOT_ALLOWED,
        });
        await expect(service.reopenShipmentTracking("shtr_missing", "user_1")).rejects.toMatchObject({
          type: MedusaError.Types.NOT_FOUND,
        });
        expect(await tracking("cancelled")).toEqual(cancelled);
      });
    });

    describe("company listing", () => {
      beforeEach(async () => {
        await service.initializeShipmentPollState(NOW);
        await service.upsertShipmentTracking([
          discovery({ bc_shipment_id: "a1" }),
          discovery({ bc_shipment_id: "b1", company_id: "comp_B", order_id: "order_B" }),
          discovery({ bc_shipment_id: "a2" }),
          discovery({ bc_shipment_id: "b2", company_id: "comp_B", order_id: "order_B" }),
          discovery({ bc_shipment_id: "a3" }),
        ]);
        for (const id of ["a1", "b1", "a2", "b2", "a3"]) {
          const company = id.startsWith("a") ? "comp_A" : "comp_B";
          await service.storeShipmentNotice(
            notice({
              bc_shipment_id: id,
              company_id: company,
              order_id: company === "comp_A" ? "order_A" : "order_B",
            })
          );
        }
      });

      it("never returns another company's rows, and pages by sequence above the cursor reading limit + 1", async () => {
        const all = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 0,
          limit: 10,
        });
        expect(all.map((row) => [row.bc_shipment_id, row.sequence])).toEqual([
          ["a1", 1],
          ["a2", 3],
          ["a3", 5],
        ]);
        expect(all.every((row) => row.company_id === "comp_A")).toBe(true);

        const firstPage = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 0,
          limit: 1,
        });
        expect(firstPage.map((row) => row.sequence)).toEqual([1, 3]);

        const afterCursor = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 3,
          limit: 10,
        });
        expect(afterCursor.map((row) => row.sequence)).toEqual([5]);

        const companyB = await service.listCompanyShipmentNotices({
          company_id: "comp_B",
          after: 0,
          limit: 10,
        });
        expect(companyB.map((row) => row.bc_shipment_id)).toEqual(["b1", "b2"]);
      });

      it("lists notices recorded at or after a time, ordered by sequence", async () => {
        const [first] = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          after: 0,
          limit: 1,
        });

        const sinceFirst = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          since: first.created_at,
          limit: 10,
        });
        expect(sinceFirst.map((row) => row.sequence)).toEqual([1, 3, 5]);

        const inTheFuture = await service.listCompanyShipmentNotices({
          company_id: "comp_A",
          since: new Date(Date.now() + 60 * 60_000),
          limit: 10,
        });
        expect(inTheFuture).toEqual([]);
      });
    });
  },
});
