import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils";
import type {
  IEventBusModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { EMPLOYEE_INVITED_EVENT } from "../../../src/workflows/employee/workflows/create-employee-account";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import {
  generatePublishableKey,
  generateStoreHeaders,
} from "../../utils/store";

jest.setTimeout(60 * 1000);

const COLLECTOR_ID = "employee-invitation-spec-collector";

type Headers = { headers: Record<string, string> };

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer;
    let eventBus: IEventBusModuleService;
    let publicHeaders: Headers;
    let storeHeaders: Headers;
    let companyId: string;
    let received: { name: string; data: unknown }[];

    const collector = async (event: { name: string; data: unknown }) => {
      received.push({ name: event.name, data: event.data });
    };

    beforeEach(async () => {
      container = getContainer();
      await createAdminUser(adminHeaders, container);
      publicHeaders = generateStoreHeaders({
        publishableKey: await generatePublishableKey(container),
      });
      const { token } = await createStoreUser({ api, storeHeaders: publicHeaders });
      storeHeaders = {
        headers: { ...publicHeaders.headers, Authorization: `Bearer ${token}` },
      };
      const company = await api.post(
        "/store/companies",
        { name: "Invite Co", email: "invite-co@example.test", currency_code: "DKK" },
        storeHeaders
      );
      companyId = company.data.companies[0].id;

      received = [];
      eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
      eventBus.subscribe(EMPLOYEE_INVITED_EVENT, collector, {
        subscriberId: COLLECTOR_ID,
      });
    });

    afterEach(() => {
      eventBus.unsubscribe(EMPLOYEE_INVITED_EVENT, collector, {
        subscriberId: COLLECTOR_ID,
      });
    });

    function storeCreate(body: Record<string, unknown>) {
      return api.post(`/store/companies/${companyId}/employees`, body, {
        ...storeHeaders,
        validateStatus: () => true,
      });
    }

    function adminCreate(body: Record<string, unknown>) {
      return api.post(`/admin/companies/${companyId}/employees`, body, {
        ...adminHeaders,
        validateStatus: () => true,
      });
    }

    async function customerIdOf(email: string): Promise<string> {
      const [customer] = await container
        .resolve(Modules.CUSTOMER)
        .listCustomers({ email });
      return customer.id;
    }

    // Released events reach listeners in emission order, so once a later control invitation has
    // arrived, any invitation from the action under test would already have been received.
    async function receivedBeforeControl(): Promise<unknown[]> {
      const delivered = TestEventUtils.waitSubscribersExecution(
        EMPLOYEE_INVITED_EVENT,
        eventBus
      );
      const control = await adminCreate({
        email: "control@example.test",
        password: "password123",
      });
      expect(control.status).toBe(200);
      await delivered;
      const controlId = await customerIdOf("control@example.test");
      const all = received.map((event) => event.data);
      expect(all[all.length - 1]).toEqual({
        customer_id: controlId,
        company_id: companyId,
        country_code: null,
      });
      return all.slice(0, -1);
    }

    it("stages one invitation with the page country after a store create", async () => {
      const delivered = TestEventUtils.waitSubscribersExecution(
        EMPLOYEE_INVITED_EVENT,
        eventBus
      );
      const response = await storeCreate({
        email: "new-employee@example.test",
        password: "password123",
        first_name: "New",
        country_code: "se",
      });
      await delivered;

      expect(response.status).toBe(200);
      expect(response.data.employee).toMatchObject({ company_id: companyId });
      const customerId = await customerIdOf("new-employee@example.test");
      expect(received).toEqual([
        {
          name: EMPLOYEE_INVITED_EVENT,
          data: { customer_id: customerId, company_id: companyId, country_code: "se" },
        },
      ]);
    });

    it("stages a store invitation with a null country when the page sends none", async () => {
      const delivered = TestEventUtils.waitSubscribersExecution(
        EMPLOYEE_INVITED_EVENT,
        eventBus
      );
      const response = await storeCreate({
        email: "no-country@example.test",
        password: "password123",
      });
      await delivered;

      expect(response.status).toBe(200);
      expect(received.map((event) => event.data)).toEqual([
        {
          customer_id: await customerIdOf("no-country@example.test"),
          company_id: companyId,
          country_code: null,
        },
      ]);
    });

    it("stages an Admin invitation with a null country", async () => {
      const delivered = TestEventUtils.waitSubscribersExecution(
        EMPLOYEE_INVITED_EVENT,
        eventBus
      );
      const response = await adminCreate({
        email: "admin-made@example.test",
        password: "password123",
      });
      await delivered;

      expect(response.status).toBe(200);
      expect(received.map((event) => event.data)).toEqual([
        {
          customer_id: await customerIdOf("admin-made@example.test"),
          company_id: companyId,
          country_code: null,
        },
      ]);
    });

    it("stages no invitation when the store links an existing customer", async () => {
      const { customer } = await createStoreUser({
        api,
        storeHeaders: publicHeaders,
        email: "linked-store@example.test",
      });
      const response = await storeCreate({ customer_id: customer.id });

      expect(response.status).toBe(200);
      expect(await receivedBeforeControl()).toEqual([]);
    });

    it("stages no invitation when Admin links an existing customer", async () => {
      const { customer } = await createStoreUser({
        api,
        storeHeaders: publicHeaders,
        email: "linked-admin@example.test",
      });
      const response = await adminCreate({ customer_id: customer.id });

      expect(response.status).toBe(200);
      expect(await receivedBeforeControl()).toEqual([]);
    });

    it("stages no invitation when the account creation fails on a duplicate email", async () => {
      const firstDelivered = TestEventUtils.waitSubscribersExecution(
        EMPLOYEE_INVITED_EVENT,
        eventBus
      );
      const first = await storeCreate({
        email: "twice@example.test",
        password: "password123",
      });
      expect(first.status).toBe(200);
      await firstDelivered;
      received = [];

      const second = await storeCreate({
        email: "twice@example.test",
        password: "password123",
        country_code: "se",
      });

      expect(second.status).toBeGreaterThanOrEqual(400);
      expect(await receivedBeforeControl()).toEqual([]);
    });

    it.each([
      ["upper-case country", { country_code: "SE" }],
      ["path-like country", { country_code: "../x" }],
      ["numeric country", { country_code: 46 }],
      ["three-letter country", { country_code: "swe" }],
      ["unknown recipient field", { to: "attacker@example.test" }],
      ["unknown company country field", { company_country: "se" }],
    ])("rejects a %s with 400 and creates nothing", async (_label, extra) => {
      const response = await storeCreate({
        email: "rejected@example.test",
        password: "password123",
        ...extra,
      });

      expect(response.status).toBe(400);
      expect(
        await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ email: "rejected@example.test" })
      ).toHaveLength(0);
      expect(await receivedBeforeControl()).toEqual([]);
    });
  },
});
