import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils";
import type {
  IEventBusModuleService,
  INotificationModuleService,
  IRegionModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { COMPANY_MODULE } from "../../../src/modules/company";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../src/modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../src/modules/storefront-translation/service";
import type { ICompanyModuleService } from "../../../src/types";
import type { MessageDocument } from "../../../src/types/storefront-translation";
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
  env: { JWT_SECRET: "supersecret", STORE_CORS: "https://shop.example.test" },
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

    it("refuses with 400 when the store tries to link an existing customer", async () => {
      const { customer } = await createStoreUser({
        api,
        storeHeaders: publicHeaders,
        email: "linked-store@example.test",
      });
      const response = await storeCreate({ customer_id: customer.id });

      expect(response.status).toBe(400);
      expect(
        await container
          .resolve<ICompanyModuleService>(COMPANY_MODULE)
          .listEmployees({ customer_id: customer.id })
      ).toHaveLength(0);
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

    describe("invitation email", () => {
      const INVITATION_TEMPLATE = "employee-invitation";
      const fullEnglish = {
        subject: "Your account (en)",
        greeting: "Hi {firstName},",
        greetingWithoutName: "Hi,",
        body: "{companyName} created your account.",
        passwordHint: "Ask your administrator.",
        loginLabel: "Log in",
      };

      const translations = () =>
        container.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
      const notifications = () =>
        container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
      const companies = () => container.resolve<ICompanyModuleService>(COMPANY_MODULE);

      async function activeLanguage(locale: string, employeeInvitation: Record<string, string>) {
        const messages: MessageDocument = { Emails: { employeeInvitation } };
        await translations().mutateDocument({
          operation: "import",
          input: { locale, expected_version: null, mode: "replace", messages, confirm_removed: false },
        });
        await translations().mutateDocument({
          operation: "activate", locale, expected_version: 1, is_active: true,
        });
      }

      // Region with se and dk; se is Swedish (its document lacks the login label), dk is Danish.
      beforeEach(async () => {
        await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: "Nordics", currency_code: "dkk", countries: ["se", "dk"],
        });
        await activeLanguage("en", fullEnglish);
        const { loginLabel: _missing, ...swedish } = { ...fullEnglish, subject: "Ditt konto (sv)" };
        await activeLanguage("sv", swedish);
        await activeLanguage("da", { ...fullEnglish, subject: "Din konto (da)" });
        await translations().bootstrapCountryLanguages({ se: "sv", dk: "da" });
      });

      async function invite(create: () => Promise<{ status: number }>) {
        const delivered = TestEventUtils.waitSubscribersExecution(EMPLOYEE_INVITED_EVENT, eventBus);
        const response = await create();
        await delivered;
        return response;
      }

      async function invitationsTo(email: string) {
        return notifications().listNotifications({ to: email, template: INVITATION_TEMPLATE });
      }

      it("sends one invitation to the invited address in the page country's language", async () => {
        const response = await invite(() =>
          storeCreate({
            email: "store-invite@example.test", password: "password123",
            first_name: "Stina", country_code: "se",
          })
        );

        expect(response.status).toBe(200);
        const stored = await invitationsTo("store-invite@example.test");
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ channel: "email", status: "success" });
        expect(stored[0].data?.locale).toBe("sv");
        const loginUrl = new URL(String(stored[0].data?.login_url));
        expect(loginUrl.origin).toBe("https://shop.example.test");
        expect(loginUrl.pathname).toBe("/se/account");
        const all = await notifications().listNotifications({ template: INVITATION_TEMPLATE });
        expect(all.map((notification) => notification.to)).toEqual(["store-invite@example.test"]);
        expect(JSON.stringify(stored[0].data)).not.toMatch(/password|token|reset-password/i);
      });

      it("uses the company country's language for an Admin invitation", async () => {
        await companies().updateCompanies({ id: companyId, country: "DK" });

        const response = await invite(() =>
          adminCreate({ email: "admin-invite@example.test", password: "password123" })
        );

        expect(response.status).toBe(200);
        const stored = await invitationsTo("admin-invite@example.test");
        expect(stored).toHaveLength(1);
        expect(stored[0].data?.locale).toBe("da");
        expect(new URL(String(stored[0].data?.login_url)).pathname).toBe("/dk/account");
      });

      it("sends English with the dk link when the company country is not a code", async () => {
        await companies().updateCompanies({ id: companyId, country: "Denmark" });

        await invite(() =>
          adminCreate({ email: "named-country@example.test", password: "password123" })
        );

        const stored = await invitationsTo("named-country@example.test");
        expect(stored).toHaveLength(1);
        expect(stored[0].data?.locale).toBe("en");
        expect(new URL(String(stored[0].data?.login_url)).pathname).toBe("/dk/account");
      });

      it("reports a missing text under the email source without personal data", async () => {
        await invite(() =>
          storeCreate({
            email: "report-invite@example.test", password: "password123",
            first_name: "Reportina", country_code: "se",
          })
        );

        expect(await invitationsTo("report-invite@example.test")).toHaveLength(1);
        const rows = await translations().listTranslationMissingKeys({ locale: "sv" });
        expect(rows).toEqual([
          expect.objectContaining({
            locale: "sv",
            key: "Emails.employeeInvitation.loginLabel",
            last_page_path: "email:employee-invitation",
          }),
        ]);
        const serialized = JSON.stringify(await translations().listTranslationMissingKeys({}));
        expect(serialized).not.toContain("report-invite@example.test");
        expect(serialized).not.toContain("Reportina");
        expect(serialized).not.toContain("Invite Co");
      });

      it("keeps the employee and answers 200 when sending the email fails", async () => {
        const failed = jest
          .spyOn(notifications(), "createNotifications")
          .mockRejectedValue(new Error("provider down"));
        try {
          const response = await invite(() =>
            storeCreate({
              email: "failed-email@example.test", password: "password123", country_code: "se",
            })
          );

          expect(response.status).toBe(200);
          expect(failed).toHaveBeenCalled();
          const { data: customers } = await container
            .resolve(ContainerRegistrationKeys.QUERY)
            .graph({
              entity: "customer",
              fields: ["id", "employee.id", "employee.company_id"],
              filters: { email: "failed-email@example.test" },
            });
          expect(customers).toHaveLength(1);
          expect(customers[0].employee).toEqual(
            expect.objectContaining({ id: expect.any(String), company_id: companyId })
          );
        } finally {
          failed.mockRestore();
        }
      });
    });
  },
});
