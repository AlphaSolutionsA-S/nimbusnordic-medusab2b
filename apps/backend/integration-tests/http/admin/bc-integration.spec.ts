import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type {
  ICustomerModuleService,
  IEventBusModuleService,
  ILockingModule,
  IOrderModuleService,
} from "@medusajs/framework/types";
import type { AxiosInstance } from "axios";
import jwt from "jsonwebtoken";
import { createAdminUser } from "../../utils/admin";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../src/modules/order-ingestion/bc-integration-state";
import type { AdminBcIntegration } from "../../../src/workflows/business-central-order/utils/admin-bc-integration";
import { READY_FOR_BUSINESS_CENTRAL_EVENT } from "../../../src/workflows/order-ingestion/workflows/enrich-order";
import {
  BC_SUBMISSION_RESERVATION_TTL,
  getBcSubmissionReservationKey,
} from "../../../src/workflows/business-central-order/utils/submission-reservation";

jest.setTimeout(120_000);
const JWT_SECRET = "supersecret";
const INITIALIZED_AT = "2026-10-01T00:00:00.000Z";
const DISCOVERY =
  "https://api.businesscentral.dynamics.com/v2.0/00000000-0000-0000-0000-000000000001/TestDK/api/v2.0";
const realNow = Date.now;
function deferred<T>() {
  let complete: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: (value: T) => complete(value) };
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET,
    COOKIE_SECRET: "nimbus158-synthetic-cookie",
    BUSINESS_CENTRAL_DISCOVERY_URL: DISCOVERY,
    BUSINESS_CENTRAL_CLIENT_ID: "00000000-0000-0000-0000-000000000002",
    BUSINESS_CENTRAL_CLIENT_SECRET: "synthetic-test-secret",
    BUSINESS_CENTRAL_COMPANY_ID: "00000000-0000-0000-0000-000000000003",
  },
  testSuite: ({ api, getContainer, utils }) => {
    const http: AxiosInstance = api;
    let orders: IOrderModuleService;
    let auth: { headers: Record<string, string> };
    let sequence = 0;
    let seededOrderIds: string[] = [];
    let vendor: {
      headers: number;
      rejectHeader: boolean;
      customerGate?: ReturnType<typeof deferred<Response>>;
      customerEntered: ReturnType<typeof deferred<void>>;
    };

    beforeEach(async () => {
      seededOrderIds = [];
      orders = getContainer().resolve(Modules.ORDER);
      auth = { headers: {} };
      await createAdminUser(auth, getContainer());
      vendor = {
        headers: 0,
        rejectHeader: false,
        customerEntered: deferred<void>(),
      };
      jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (
            url ===
            "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/oauth2/v2.0/token"
          ) {
            return Response.json({ access_token: "synthetic-vendor-token" });
          }
          if (!url.startsWith(`${DISCOVERY}/`))
            throw new Error(
              "Unexpected outbound request blocked by test vendor"
            );
          const pathname = new URL(url).pathname;
          if (pathname.endsWith("/customers()")) {
            vendor.customerEntered.resolve();
            if (vendor.customerGate) return vendor.customerGate.promise;
            return Response.json({
              value: [
                {
                  number: "TEST-CUSTOMER",
                  displayName: "Synthetic customer",
                  currency: { code: "DKK" },
                },
              ],
            });
          }
          if (pathname.endsWith("/items()"))
            return Response.json({
              value: [
                {
                  id: "00000000-0000-0000-0000-000000000004",
                  number: "TEST-ITEM",
                  displayName: "Synthetic item",
                  gtin: "0000000000000",
                  baseUnitOfMeasureCode: "PCS",
                },
              ],
            });
          if (pathname.endsWith("/salesOrders") && init?.method === "POST") {
            vendor.headers += 1;
            if (vendor.rejectHeader)
              return Response.json(
                { error: { message: "synthetic private vendor detail" } },
                { status: 400 }
              );
            return Response.json(
              {
                id: `00000000-0000-0000-0000-${String(vendor.headers).padStart(
                  12,
                  "0"
                )}`,
                number: `SO-TEST-${vendor.headers}`,
                status: "Draft",
              },
              { status: 201 }
            );
          }
          if (pathname.endsWith("/salesOrderLines") && init?.method === "POST")
            return Response.json({ id: "synthetic-line" }, { status: 201 });
          throw new Error("Unexpected outbound request blocked by test vendor");
        });
    });
    afterEach(async () => {
      vendor?.customerGate?.resolve(
        Response.json({
          value: [{ number: "TEST-CUSTOMER", currency: { code: "DKK" } }],
        })
      );
      await utils.waitWorkflowExecutions();
      for (const id of seededOrderIds) await waitReservationReleased(id);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    async function seed(
      options: {
        state?: Partial<BcIntegrationState>;
        tracked?: boolean;
        canonical?: boolean;
      } = {}
    ) {
      sequence += 1;
      const company = await getContainer()
        .resolve<ICompanyModuleService>(COMPANY_MODULE)
        .createCompanies({
          name: `Synthetic company ${sequence}`,
          email: `company-${sequence}@example.test`,
          phone: "",
          address: null,
          city: null,
          state: null,
          zip: null,
          country: "DK",
          logo_url: null,
          currency_code: "dkk",
          spending_limit_reset_frequency: null,
          business_central_customer_number: "TEST-CUSTOMER",
        });
      const metadata: Record<string, unknown> = {
        company_id: company.id,
        order_ingestion_state: "ready_for_business_central",
      };
      if (options.tracked !== false)
        metadata[BC_INTEGRATION_STATE_METADATA_KEY] = {
          ...createInitialBcIntegrationState(INITIALIZED_AT),
          ...options.state,
        };
      if (options.canonical !== false)
        metadata.canonical_order = {
          externalOrderNumber: `SYNTHETIC-${sequence}`,
          orderDate: "01-10-2026",
          currencyCode: "DKK",
          lines: [
            {
              lineNumber: 1,
              itemNumber: "TEST-ITEM",
              eanNo: "0000000000000",
              quantity: 1,
              unitPrice: 1,
            },
          ],
        };
      const order = await orders.createOrders({
        currency_code: "dkk",
        metadata,
      });
      seededOrderIds.push(order.id);
      return order;
    }
    async function read(id: string): Promise<AdminBcIntegration> {
      return (
        await http.get<{ bc_integration: AdminBcIntegration }>(
          `/admin/orders/${id}/bc-integration`,
          auth
        )
      ).data.bc_integration;
    }
    async function waitStatus(
      id: string,
      status: string,
      attempts?: number
    ): Promise<AdminBcIntegration> {
      const deadline = realNow() + 10_000;
      while (realNow() < deadline) {
        const state = await read(id);
        if (
          state.status === status &&
          (attempts === undefined || state.attempt_count === attempts)
        )
          return state;
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`Timed out waiting for synthetic order status ${status}`);
    }
    function submit(id: string, body: unknown = {}) {
      return http.post(`/admin/orders/${id}/bc-integration/submit`, body, {
        ...auth,
        validateStatus: () => true,
      });
    }

    async function waitReservationReleased(id: string) {
      const locking: ILockingModule = getContainer().resolve(Modules.LOCKING);
      const key = getBcSubmissionReservationKey(id);
      const deadline = realNow() + 10_000;
      while (realNow() < deadline) {
        try {
          await locking.acquire(key, {
            ownerId: "completion-probe",
            expire: 10,
          });
          await locking.release(key, { ownerId: "completion-probe" });
          return;
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== `Failed to acquire lock for key "${key}"`
          )
            throw error;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(
        "Timed out waiting for completed submission reservation release"
      );
    }

    it("returns typed whitelisted state and excludes canonical payload/vendor details", async () => {
      const order = await seed({
        state: {
          status: "failed",
          attempt_count: 3,
          failure_reason: "synthetic secret",
          partial: true,
          line_failures: [
            {
              line_number: 1,
              reason: "rejected_by_bc",
              message: "synthetic private token",
              ean_no: "secret",
              item_number: "secret",
              cust_item_no: "secret",
            },
          ],
        },
      });
      const response = await http.get<{ bc_integration: AdminBcIntegration }>(
        `/admin/orders/${order.id}/bc-integration`,
        auth
      );
      expect(Object.keys(response.data)).toEqual(["bc_integration"]);
      const state = response.data.bc_integration;
      expect(Object.keys(state).sort()).toEqual(
        [
          "status",
          "bc_order_id",
          "bc_order_number",
          "attempt_count",
          "initialized_at",
          "last_attempt_at",
          "sent_at",
          "partial",
          "failure_reason",
          "line_failures",
        ].sort()
      );
      expect(state.line_failures).toEqual([
        { line_number: 1, reason: "rejected_by_bc" },
      ]);
      expect(state).toMatchObject({
        status: "failed",
        attempt_count: 3,
        initialized_at: INITIALIZED_AT,
        partial: true,
        failure_reason: null,
        line_failures: [{ line_number: 1, reason: "rejected_by_bc" }],
      });
      expect(typeof state.attempt_count).toBe("number");
      expect(typeof state.partial).toBe("boolean");
      expect(typeof state.initialized_at).toBe("string");
      expect(typeof state.line_failures[0].line_number).toBe("number");
      expect(typeof state.line_failures[0].reason).toBe("string");
      expect(JSON.stringify(response.data)).not.toMatch(
        /canonical_order|synthetic private|synthetic secret|ean_no|cust_item_no/
      );
      const untracked = await seed({ tracked: false });
      expect(await read(untracked.id)).toMatchObject({
        status: null,
        bc_order_id: null,
        attempt_count: 0,
      });
    });

    it("denies anonymous, invalid and customer bearer access to both admin operations", async () => {
      const order = await seed();
      const customers: ICustomerModuleService = getContainer().resolve(
        Modules.CUSTOMER
      );
      const customer = await customers.createCustomers({
        email: "synthetic-customer@example.test",
      });
      const token = jwt.sign(
        {
          actor_id: customer.id,
          actor_type: "customer",
          auth_identity_id: "synthetic-identity",
        },
        JWT_SECRET
      );
      for (const headers of [
        {},
        { authorization: "Bearer invalid-token" },
        { authorization: `Bearer ${token}` },
      ]) {
        for (const [method, suffix] of [
          ["GET", ""],
          ["POST", "/submit"],
        ]) {
          const response = await http.request({
            method,
            url: `/admin/orders/${order.id}/bc-integration${suffix}`,
            headers,
            data: method === "POST" ? {} : undefined,
            validateStatus: () => true,
          });
          expect(response.status).toBe(401);
        }
      }
      expect(vendor.headers).toBe(0);
    });

    it("returns 404 for missing orders and 400 for malformed/extra force intent", async () => {
      expect(
        (
          await http.get("/admin/orders/nonexistent/bc-integration", {
            ...auth,
            validateStatus: () => true,
          })
        ).status
      ).toBe(404);
      expect((await submit("nonexistent")).status).toBe(404);
      const order = await seed();
      for (const body of [
        { force_resend: "true" },
        { force_resend: 1 },
        { force_resend: true, unexpected: "field" },
      ])
        expect((await submit(order.id, body)).status).toBe(400);
      expect(vendor.headers).toBe(0);
    });

    it("accepts normal submission asynchronously and refresh reads persisted completion", async () => {
      const order = await seed();
      vendor.customerGate = deferred<Response>();
      const response = await submit(order.id);
      expect(response.status).toBe(202);
      await vendor.customerEntered.promise;
      expect(vendor.headers).toBe(0);
      expect((await read(order.id)).status).toBe("pending");
      expect((await submit(order.id)).status).toBe(409);
      expect((await submit(order.id, { force_resend: true })).status).toBe(409);
      vendor.customerGate.resolve(
        Response.json({
          value: [{ number: "TEST-CUSTOMER", currency: { code: "DKK" } }],
        })
      );
      const completed = await waitStatus(order.id, "sent");
      expect(completed.bc_order_id).toBe(
        "00000000-0000-0000-0000-000000000001"
      );
      expect(completed.bc_order_number).toBe("SO-TEST-1");
      expect(completed.attempt_count).toBe(1);
      expect(typeof completed.last_attempt_at).toBe("string");
      expect(typeof completed.sent_at).toBe("string");
    });

    it("normal requests retain duplicate protection while explicit force invokes existing delivery", async () => {
      const order = await seed({
        state: {
          status: "sent",
          bc_order_id: "existing-bc-id",
          bc_order_number: "SO-EXISTING",
          attempt_count: 4,
          sent_at: INITIALIZED_AT,
        },
      });
      expect((await submit(order.id)).status).toBe(202);
      await utils.waitWorkflowExecutions();
      expect(vendor.headers).toBe(0);
      expect((await read(order.id)).attempt_count).toBe(4);
      await waitReservationReleased(order.id);
      expect((await submit(order.id, { force_resend: true })).status).toBe(202);
      await waitStatus(order.id, "sent", 5);
      await utils.waitWorkflowExecutions();
      const final = await read(order.id);
      expect(vendor.headers).toBe(1);
      expect(final.bc_order_id).not.toBe("existing-bc-id");
      expect(final.attempt_count).toBe(5);
    });

    it("failed force retains previous identity and keeps later ordinary requests duplicate-safe", async () => {
      const order = await seed({
        state: {
          status: "sent",
          bc_order_id: "existing-bc-id",
          bc_order_number: "SO-EXISTING",
          attempt_count: 4,
          sent_at: INITIALIZED_AT,
        },
      });
      vendor.rejectHeader = true;
      expect((await submit(order.id, { force_resend: true })).status).toBe(202);
      const failed = await waitStatus(order.id, "failed");
      expect(failed).toMatchObject({
        bc_order_id: "existing-bc-id",
        bc_order_number: "SO-EXISTING",
        attempt_count: 5,
        sent_at: INITIALIZED_AT,
        failure_reason: "bc_submission_failed",
      });
      expect(JSON.stringify(failed)).not.toContain("synthetic private");
      await utils.waitWorkflowExecutions();
      await waitReservationReleased(order.id);
      expect((await submit(order.id)).status).toBe(202);
      await utils.waitWorkflowExecutions();
      expect(vendor.headers).toBe(1);
      expect((await read(order.id)).attempt_count).toBe(5);
    });

    it("accepts real Admin session authentication for both operations", async () => {
      const order = await seed({
        state: { status: "sent", bc_order_id: "session-existing" },
      });
      const login = await http.post<{ token: string }>("/auth/user/emailpass", {
        email: "admin@medusa.js",
        password: "somepassword",
      });
      const session = await http.post(
        "/auth/session",
        {},
        { headers: { authorization: `Bearer ${login.data.token}` } }
      );
      const cookies = session.headers["set-cookie"] ?? [];
      expect(cookies.length).toBeGreaterThan(0);
      const sessionAuth = {
        headers: {
          cookie: cookies
            .map((cookie: string) => cookie.split(";")[0])
            .join("; "),
        },
      };
      expect(
        (
          await http.get(
            `/admin/orders/${order.id}/bc-integration`,
            sessionAuth
          )
        ).status
      ).toBe(200);
      expect(
        (
          await http.post(
            `/admin/orders/${order.id}/bc-integration/submit`,
            {},
            sessionAuth
          )
        ).status
      ).toBe(202);
      await utils.waitWorkflowExecutions();
      expect(vendor.headers).toBe(0);
    });

    it("allows a completed failed attempt to retry with the shared deterministic transaction id", async () => {
      const order = await seed();
      vendor.rejectHeader = true;
      expect((await submit(order.id)).status).toBe(202);
      expect(await waitStatus(order.id, "failed", 1)).toMatchObject({
        bc_order_id: null,
        attempt_count: 1,
      });
      await waitReservationReleased(order.id);
      vendor.rejectHeader = false;
      expect((await submit(order.id)).status).toBe(202);
      const completed = await waitStatus(order.id, "sent", 2);
      expect(completed.bc_order_number).toBe("SO-TEST-2");
      expect(vendor.headers).toBe(2);
    });

    it("rejects Admin overlap while the automatic subscriber runs the real delivery workflow", async () => {
      const order = await seed();
      vendor.customerGate = deferred<Response>();
      const eventBus: IEventBusModuleService = getContainer().resolve(
        Modules.EVENT_BUS
      );
      await eventBus.emit({
        name: READY_FOR_BUSINESS_CENTRAL_EVENT,
        data: { order_id: order.id },
      });
      await vendor.customerEntered.promise;
      expect((await submit(order.id)).status).toBe(409);
      expect((await submit(order.id, { force_resend: true })).status).toBe(409);
      vendor.customerGate.resolve(
        Response.json({
          value: [{ number: "TEST-CUSTOMER", currency: { code: "DKK" } }],
        })
      );
      expect((await waitStatus(order.id, "sent", 1)).bc_order_number).toBe(
        "SO-TEST-1"
      );
      await waitReservationReleased(order.id);
      expect(vendor.headers).toBe(1);
    });

    it("does not release a reservation for a different owner", async () => {
      const order = await seed();
      const locking: ILockingModule = getContainer().resolve(Modules.LOCKING);
      const key = getBcSubmissionReservationKey(order.id);
      await locking.acquire(key, {
        ownerId: "actual-owner",
        expire: BC_SUBMISSION_RESERVATION_TTL,
      });
      await locking.release(key, { ownerId: "wrong-owner" });
      expect((await submit(order.id)).status).toBe(409);
      await locking.release(key, { ownerId: "actual-owner" });
      expect((await submit(order.id)).status).toBe(202);
      await waitStatus(order.id, "sent", 1);
    });

    it("compensates a reservation if the event-emission boundary fails before acceptance", async () => {
      const order = await seed();
      const eventBus: IEventBusModuleService = getContainer().resolve(
        Modules.EVENT_BUS
      );
      const fault = jest
        .spyOn(eventBus, "emit")
        .mockRejectedValueOnce(new Error("synthetic private queue detail"));
      const response = await submit(order.id);
      fault.mockRestore();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.data)).not.toContain("synthetic private");
      await waitReservationReleased(order.id);
      expect(vendor.headers).toBe(0);
      expect((await submit(order.id)).status).toBe(202);
      await waitStatus(order.id, "sent", 1);
    });

    it("renews an active reservation past its original TTL, recovers a transient renewal failure, and cleans up", async () => {
      const order = await seed();
      vendor.customerGate = deferred<Response>();
      // Keep Postgres/network scheduling real; control only wall clock and renewal intervals.
      jest.useFakeTimers({
        doNotFake: [
          "nextTick",
          "queueMicrotask",
          "setImmediate",
          "clearImmediate",
          "setTimeout",
          "clearTimeout",
          "performance",
          "hrtime",
        ],
      });
      expect((await submit(order.id)).status).toBe(202);
      await vendor.customerEntered.promise;
      const locking: ILockingModule = getContainer().resolve(Modules.LOCKING);
      // Fault injection at the lease primitive; all following acquire calls use its real implementation.
      const fault = jest
        .spyOn(locking, "acquire")
        .mockRejectedValueOnce(
          new Error("synthetic transient renewal failure")
        );
      await jest.advanceTimersByTimeAsync(
        BC_SUBMISSION_RESERVATION_TTL * 1000 + 1000
      );
      fault.mockRestore();
      expect(vendor.headers).toBe(0);
      expect((await submit(order.id)).status).toBe(409);
      expect((await submit(order.id, { force_resend: true })).status).toBe(409);
      vendor.customerGate.resolve(
        Response.json({
          value: [{ number: "TEST-CUSTOMER", currency: { code: "DKK" } }],
        })
      );
      expect((await waitStatus(order.id, "sent", 1)).attempt_count).toBe(1);
      await waitReservationReleased(order.id);
      expect(jest.getTimerCount()).toBe(0);
      vendor.customerGate = undefined;
      jest.useRealTimers();
      expect((await submit(order.id, { force_resend: true })).status).toBe(202);
      await waitStatus(order.id, "sent", 2);
      expect(vendor.headers).toBe(2);
    });
  },
});
