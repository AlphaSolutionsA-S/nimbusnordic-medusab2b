import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import businessCentralOrderReadyHandler, {
  config as businessCentralOrderReadyConfig,
} from "../../../src/subscribers/business-central-order-ready";
import {
  enrichOrderWorkflow,
  READY_FOR_BUSINESS_CENTRAL_EVENT,
} from "../../../src/workflows/order-ingestion/workflows/enrich-order";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCCreatedSalesOrder,
  BCCustomer,
  BCItemLookupResult,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import type { BcIntegrationState } from "../../../src/modules/order-ingestion/bc-integration-state";
import { singleLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

const BC_CUSTOMER: BCCustomer = {
  number: "579000283084",
  displayName: "METZ A/S",
  email: "",
  phoneNumber: "",
  addressLine1: "Skelstedet 9",
  addressLine2: "",
  city: "Vedbæk",
  state: "",
  postalCode: "2950",
  country: "DK",
  blocked: "not_blocked",
  creditLimit: null,
  taxRegistrationNumber: "",
  currencyCode: "DKK",
};

const LOOKUP_RESULTS: BCItemLookupResult[] = [
  {
    lineNumber: 1,
    matched: true,
    matchedBy: "eanNo",
    item: {
      id: "11111111-1111-1111-1111-111111111111",
      number: "FLS-NIM-VESPERMNA-XL",
      displayName: "Vesper Vest Unisex, Navy - XL",
      gtin: "5712094145752",
      baseUnitOfMeasureCode: "PCS",
    },
  },
];

const CREATED: BCCreatedSalesOrder = {
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-009999",
  status: "Draft",
  acceptedLineNumbers: [1],
  rejectedLines: [],
};

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("business-central-order-ready subscriber", () => {
      let counter = 0;

      async function seedOrder() {
        counter += 1;
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const company = await companyService.createCompanies({
          name: `BC Subscriber Co ${counter}`,
          email: `bc-sub-${counter}@example.com`,
          business_central_customer_number: "579000283084",
        });

        return orderModuleService.createOrders({
          currency_code: "dkk",
          metadata: {
            company_id: company.id,
            order_ingestion_state: "created",
            canonical_order: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: `BC-SUB-${counter}`,
            },
            [BC_INTEGRATION_STATE_METADATA_KEY]:
              createInitialBcIntegrationState("2026-09-29T10:00:00.000Z"),
          },
        });
      }

      // Stubs all three BC methods the workflow calls, so these tests never reach the test tenant.
      function stubBusinessCentral() {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );

        jest.spyOn(bcService, "getCustomer").mockResolvedValue(BC_CUSTOMER);
        jest
          .spyOn(bcService, "findItemsForOrderLines")
          .mockResolvedValue(LOOKUP_RESULTS);

        return jest.spyOn(bcService, "createSalesOrder").mockResolvedValue(CREATED);
      }

      async function readIntegrationState(
        orderId: string
      ): Promise<BcIntegrationState | undefined> {
        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(orderId, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        return metadata[BC_INTEGRATION_STATE_METADATA_KEY] as
          | BcIntegrationState
          | undefined;
      }

      async function waitForStatus(
        orderId: string,
        expected: string,
        timeoutMs = 10000
      ): Promise<BcIntegrationState> {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
          const state = await readIntegrationState(orderId);

          if (state?.status === expected) {
            return state;
          }

          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        throw new Error(
          `Timed out waiting for order ${orderId} to reach BC status "${expected}"`
        );
      }

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: runs the submission workflow for the order in the event payload", async () => {
        const container = getContainer();
        const order = await seedOrder();
        const createSalesOrder = stubBusinessCentral();

        await businessCentralOrderReadyHandler({
          event: {
            name: READY_FOR_BUSINESS_CENTRAL_EVENT,
            data: { order_id: order.id },
          },
          container,
        } as never);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);

        const state = await readIntegrationState(order.id);
        expect(state?.status).toEqual("sent");
        expect(state?.bc_order_id).toEqual(CREATED.id);
        expect(state?.attempt_count).toEqual(1);
      });

      it("TC-2: resolves instead of throwing when the workflow rejects", async () => {
        const handlerPromise = businessCentralOrderReadyHandler({
          event: {
            name: READY_FOR_BUSINESS_CENTRAL_EVENT,
            data: { order_id: "order_does_not_exist" },
          },
          container: getContainer(),
        } as never);

        await expect(handlerPromise).resolves.toBeUndefined();
      });

      it("TC-3: is registered for the boundary event the ingestion chain emits", () => {
        expect(businessCentralOrderReadyConfig.event).toEqual(
          READY_FOR_BUSINESS_CENTRAL_EVENT
        );
        expect(businessCentralOrderReadyConfig.event).toEqual(
          "order_ingestion.ready_for_business_central"
        );
      });

      it("TC-4: the real event chain drives the order to sent end to end", async () => {
        const order = await seedOrder();
        stubBusinessCentral();

        await enrichOrderWorkflow(getContainer()).run({
          input: { order_id: order.id },
        });

        const state = await waitForStatus(order.id, "sent");
        expect(state.bc_order_id).toEqual(CREATED.id);
      });

      it("TC-5: creates one BC order when the event is handled twice at once", async () => {
        const container = getContainer();
        const order = await seedOrder();
        const createSalesOrder = stubBusinessCentral();
        const event = {
          event: {
            name: READY_FOR_BUSINESS_CENTRAL_EVENT,
            data: { order_id: order.id },
          },
          container,
        } as never;

        await Promise.all([
          businessCentralOrderReadyHandler(event),
          businessCentralOrderReadyHandler(event),
        ]);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);

        const state = await readIntegrationState(order.id);
        expect(state?.status).toEqual("sent");
        expect(state?.attempt_count).toEqual(1);
      });
    });
  },
});
