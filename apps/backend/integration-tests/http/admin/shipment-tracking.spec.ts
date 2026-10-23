import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { createAdminUser } from "../../utils/admin";
import { createApiCustomerCompany, orderApiSecretHeaders, setOrderApiEnabled } from "../../utils/shipment-notices";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type { IBusinessCentralModuleService } from "../../../src/modules/business-central/types";
import { BC_INTEGRATION_STATE_METADATA_KEY, createInitialBcIntegrationState } from "../../../src/modules/order-ingestion/bc-integration-state";
import { checkShipmentsWorkflow } from "../../../src/workflows/shipment-notice/workflows/check-shipments";

jest.setTimeout(180_000);
const DAY = 86_400_000;

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let auth: { headers: Record<string, string> };
    let actorId: string;
    let companyId: string;
    let service: OrderIngestionModuleService;
    let counter = 0;
    beforeEach(async () => {
      auth = { headers: {} };
      const { user } = await createAdminUser(auth, getContainer());
      actorId = user.id;
      const login = await api.post("/auth/user/emailpass", { email: "admin@medusa.js", password: "somepassword" });
      auth.headers.authorization = `Bearer ${login.data.token}`;
      companyId = await createApiCustomerCompany(getContainer(), "C-RETRY");
      service = getContainer().resolve(ORDER_INGESTION_MODULE);
      await service.initializeShipmentPollState(new Date());
    });
    afterEach(() => jest.restoreAllMocks());

    async function seed(
      reason:
        | "gave_up" | "window_ended" | "cancelled" | "superseded" | "company_not_enabled" | null = "gave_up",
      postingDate = "2026-01-01",
    ) {
      counter += 1;
      const shipmentId = `bc-retry-${counter}`;
      const order = await getContainer().resolve<IOrderModuleService>(Modules.ORDER).createOrders({
        currency_code: "dkk",
        metadata: { [BC_INTEGRATION_STATE_METADATA_KEY]: {
          ...createInitialBcIntegrationState(new Date().toISOString()),
          status: "sent", bc_order_number: "SO-RETRY", bc_lines: [],
        } },
      });
      await service.upsertShipmentTracking([{
        bc_shipment_id: shipmentId, shipment_number: `SS-RETRY-${counter}`,
        bc_order_number: "SO-RETRY", posting_date: postingDate, company_id: companyId,
        order_id: order.id, external_order_number: "EXT-RETRY",
        next_check_at: new Date(), recheck_until: new Date(Date.now() - 10 * DAY),
      }]);
      if (reason) await service.closeShipmentTracking(shipmentId, {
        close_reason: reason, attempts: 8, last_error: "bc_missing", last_checked_at: null,
        final_check_done: false,
      });
      return (await service.listShipmentTrackings({ bc_shipment_id: shipmentId }))[0];
    }

    it("lists only gave-up rows newest first with safe typed fields and paging", async () => {
      const first = await seed();
      const second = await seed();
      await seed("window_ended");
      await seed(null);
      const response = await api.get("/admin/shipment-tracking?limit=1&offset=0", auth);
      expect(response.data).toMatchObject({ count: 2, limit: 1, offset: 0 });
      expect(response.data.shipment_trackings).toEqual([{
        id: second.id, shipment_number: second.shipment_number, bc_order_number: "SO-RETRY",
        order_id: second.order_id, external_order_number: "EXT-RETRY", company_id: companyId,
        company_name: "Notice Co C-RETRY", last_error: "bc_missing", attempts: 8,
        closed_at: expect.any(String),
      }]);
      expect(new Date(response.data.shipment_trackings[0].closed_at).getTime()).toBeGreaterThan(0);
      const next = await api.get("/admin/shipment-tracking?limit=1&offset=1", auth);
      expect(next.data.shipment_trackings[0].id).toBe(first.id);
    });

    it("overview lists every shipment in any state, newest posting date first, with safe fields and paging", async () => {
      const open = await seed(null, "2026-03-05");
      const gaveUp = await seed("gave_up", "2026-03-04");
      const windowEnded = await seed("window_ended", "2026-03-03");
      const cancelled = await seed("cancelled", "2026-03-02");
      const superseded = await seed("superseded", "2026-03-01");
      const companyOff = await seed("company_not_enabled", "2026-02-28");
      const response = await api.get("/admin/shipment-tracking/overview", auth);
      expect(response.data).toMatchObject({ count: 6, limit: 50, offset: 0 });
      expect(response.data.shipment_trackings).toEqual(([
        [open, "open", null], [gaveUp, "closed", "gave_up"], [windowEnded, "closed", "window_ended"],
        [cancelled, "closed", "cancelled"], [superseded, "closed", "superseded"],
        [companyOff, "closed", "company_not_enabled"],
      ] as const).map(([row, state, closeReason]) => ({
        id: row.id, shipment_number: row.shipment_number, bc_order_number: "SO-RETRY",
        external_order_number: "EXT-RETRY", company_id: companyId, company_name: "Notice Co C-RETRY",
        posting_date: row.posting_date, state, close_reason: closeReason,
      })));
      const page = await api.get("/admin/shipment-tracking/overview?limit=2&offset=2", auth);
      expect(page.data).toMatchObject({ count: 6, limit: 2, offset: 2 });
      expect(page.data.shipment_trackings.map((row: { id: string }) => row.id)).toEqual([windowEnded.id, cancelled.id]);
    });

    it("overview breaks equal posting dates by id, newest id first", async () => {
      const ids = [(await seed(null)).id, (await seed("gave_up")).id];
      const response = await api.get("/admin/shipment-tracking/overview", auth);
      expect(response.data.shipment_trackings.map((row: { id: string }) => row.id)).toEqual([...ids].sort().reverse());
    });

    it("reopens once, records the authenticated actor, and preserves revision", async () => {
      const row = await seed();
      await service.updateShipmentTrackings({ id: row.id, latest_revision: 3 });
      const before = Date.now();
      const response = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, auth);
      expect(response.status).toBe(200);
      expect(response.data.shipment_tracking).toMatchObject({
        id: row.id, state: "open", close_reason: null, closed_at: null, attempts: 0,
        reopened_by: actorId, latest_revision: 3,
      });
      expect(Date.parse(response.data.shipment_tracking.reopened_at)).toBeGreaterThanOrEqual(before - 1000);
      expect(Date.parse(response.data.shipment_tracking.next_check_at)).toBeLessThanOrEqual(Date.now());
      const again = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, { ...auth, validateStatus: () => true });
      expect(again.status).toBe(400);
      expect(again.data.type).toBe("not_allowed");
    });

    it("refuses window-ended, open and unknown rows", async () => {
      for (const reason of ["window_ended", null] as const) {
        const row = await seed(reason);
        const response = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, { ...auth, validateStatus: () => true });
        expect(response.status).toBe(400);
        expect(response.data.type).toBe("not_allowed");
      }
      const response = await api.post("/admin/shipment-tracking/shtr_missing/retry", {}, { ...auth, validateStatus: () => true });
      expect(response.status).toBe(404);
    });

    it("refuses a gave-up row of a switched-off company and leaves it unchanged, then reopens it once switched on", async () => {
      const row = await seed();
      await setOrderApiEnabled(getContainer(), companyId, false);
      const refused = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, { ...auth, validateStatus: () => true });
      expect(refused.status).toBe(400);
      expect(refused.data).toEqual({
        type: "not_allowed", message: "The company is not enabled for the order API",
      });
      const [unchanged] = await service.listShipmentTrackings({ id: row.id });
      expect(unchanged).toMatchObject({
        state: "closed", close_reason: "gave_up", attempts: 8, reopened_by: null, reopened_at: null,
      });
      const missing = await api.post("/admin/shipment-tracking/shtr_missing/retry", {}, { ...auth, validateStatus: () => true });
      expect(missing.status).toBe(404);

      await setOrderApiEnabled(getContainer(), companyId, true);
      const reopened = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, auth);
      expect(reopened.status).toBe(200);
      expect(reopened.data.shipment_tracking).toMatchObject({
        id: row.id, state: "open", close_reason: null, reopened_by: actorId,
      });
    });

    it("rejects unknown query/body keys, invalid paging and invalid ids", async () => {
      const row = await seed();
      for (const path of ["/admin/shipment-tracking", "/admin/shipment-tracking/overview"]) {
        for (const query of ["limit=0", "offset=-1", "limit=201", "fields=*", "offset=1.5", "state=open"]) {
          expect({ path, query, status: (await api.get(`${path}?${query}`, { ...auth, validateStatus: () => true })).status })
            .toEqual({ path, query, status: 400 });
        }
      }
      for (const [url, body] of [
        [`/admin/shipment-tracking/${row.id}/retry`, { reopened_by: "spoofed" }],
        ["/admin/shipment-tracking/invalid!id/retry", {}],
        [`/admin/shipment-tracking/${row.id}/retry?extra=true`, {}],
      ] as const) {
        expect((await api.post(url, body, { ...auth, validateStatus: () => true })).status).toBe(400);
      }
    });

    it("accepts the default secret API key authentication and records its actor id", async () => {
      const row = await seed();
      const response = await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, {
        headers: await orderApiSecretHeaders(getContainer()),
      });
      expect(response.status).toBe(200);
      expect(response.data.shipment_tracking.reopened_by).toEqual(expect.stringMatching(/^apk_/));
    });

    it("checks a retried row next run and gives up only three days after reopening", async () => {
      const row = await seed();
      const bc = getContainer().resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
      const read = jest.spyOn(bc, "getShipmentsByNumbers").mockResolvedValue([]);
      await api.post(`/admin/shipment-tracking/${row.id}/retry`, {}, auth);
      const { result } = await checkShipmentsWorkflow(getContainer()).run({ input: { deadline: new Date(Date.now() + 60_000) } });
      expect(result.checked).toBe(1);
      expect(read).toHaveBeenCalledWith([row.shipment_number], expect.any(Number));
      const [after] = await service.listShipmentTrackings({ id: row.id });
      expect(after).toMatchObject({ state: "open", attempts: 1 });
      await service.updateShipmentTrackings({ id: row.id, next_check_at: new Date(), reopened_at: new Date(Date.now() - 3 * DAY - 1000) });
      await checkShipmentsWorkflow(getContainer()).run({ input: { deadline: new Date(Date.now() + 60_000) } });
      expect((await service.listShipmentTrackings({ id: row.id }))[0]).toMatchObject({ state: "closed", close_reason: "gave_up" });
    });
  },
});
