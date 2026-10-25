import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { WorkflowManager } from "@medusajs/framework/orchestration";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, Logger } from "@medusajs/framework/types";
import pollShipmentNoticesJob, { config } from "../../../src/jobs/poll-shipment-notices";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import type {
  BCShipment,
  BCShipmentHeader,
  BCShipmentWindow,
  IBusinessCentralModuleService,
} from "../../../src/modules/business-central/types";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import { createApiCustomerCompany } from "../../utils/shipment-notices";

jest.setTimeout(120 * 1000);

const MINUTE = 60 * 1000;
const at = (base: Date, offsetMs: number): Date => new Date(base.getTime() + offsetMs);
const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

function postedShipment(header: BCShipmentHeader): BCShipment {
  const address = {
    name: "Receiver",
    addressLine1: "Street 1",
    addressLine2: null,
    city: "Aarhus",
    state: null,
    postCode: "8000",
    country: "DK",
  };
  return {
    ...header,
    shipmentMethodCode: "DHL",
    yourReference: null,
    sellTo: { customerNumber: header.customerNumber, ...address },
    billTo: { customerNumber: header.customerNumber, ...address },
    shipTo: { ...address, contact: null },
    lines: [
      {
        sequence: 10000,
        lineType: "item",
        itemNumber: "ITEM-1",
        description: "Widget",
        description2: null,
        unitOfMeasureCode: "PCS",
        quantity: 5,
        shipmentDate: null,
      },
    ],
  };
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("shipment notice poll job", () => {
      let headers: BCShipmentHeader[];
      let countShipments: jest.SpyInstance;
      let listShipmentHeaders: jest.SpyInstance;
      let getShipmentsByNumbers: jest.SpyInstance;
      let info: jest.SpyInstance;
      let warn: jest.SpyInstance;

      const orderIngestion = (): OrderIngestionModuleService =>
        getContainer().resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

      const inWindow = (window: BCShipmentWindow): BCShipmentHeader[] =>
        headers.filter((header) => {
          const modified = new Date(header.lastModifiedDateTime).getTime();
          return modified > window.after.getTime() && modified <= window.until.getTime();
        });

      beforeEach(() => {
        headers = [];
        const bc = getContainer().resolve<IBusinessCentralModuleService>(BUSINESS_CENTRAL_MODULE);
        countShipments = jest
          .spyOn(bc, "countShipments")
          .mockImplementation(async (window) => inWindow(window).length);
        listShipmentHeaders = jest
          .spyOn(bc, "listShipmentHeaders")
          .mockImplementation(async (window) => inWindow(window));
        getShipmentsByNumbers = jest
          .spyOn(bc, "getShipmentsByNumbers")
          .mockImplementation(async (numbers: readonly string[]) =>
            headers.filter((header) => numbers.includes(header.number)).map(postedShipment)
          );
        // Stubbed too: an unstubbed read would call the configured BC environment.
        jest
          .spyOn(bc, "getShipmentLineVariants")
          .mockImplementation(async (numbers: readonly string[]) =>
            headers
              .filter((header) => numbers.includes(header.number))
              .map((header) => ({ shipmentNumber: header.number, lineNumber: 10000, variantCode: null }))
          );
        const logger = getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER);
        info = jest.spyOn(logger, "info");
        warn = jest.spyOn(logger, "warn");
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      async function seedApiOrder() {
        const container = getContainer();
        const orders = container.resolve<IOrderModuleService>(Modules.ORDER);

        const company = { id: await createApiCustomerCompany(container, "C-100") };
        const order = await orders.createOrders({
          currency_code: "dkk",
          metadata: {
            company_id: company.id,
            [BC_INTEGRATION_STATE_METADATA_KEY]: {
              ...createInitialBcIntegrationState("2026-10-19T08:00:00.000Z"),
              status: "sent",
              bc_order_id: "bc-SO-100",
              bc_order_number: "SO-100",
            },
          },
        });
        await orderIngestion().createOrderExternalReferences({
          company_id: company.id,
          order_id: order.id,
          external_order_number: "METZ-1",
        });
        return order;
      }

      function header(lastModified: Date): BCShipmentHeader {
        return {
          id: "bc-shp-poll-1",
          number: "SS-POLL-1",
          orderNumber: "SO-100",
          externalDocumentNumber: "METZ-1",
          customerNumber: "C-100",
          postingDate: utcDay(new Date()),
          lastModifiedDateTime: lastModified.toISOString(),
        };
      }

      const infoLines = (): string[] => info.mock.calls.map(([line]) => String(line));
      const warnLines = (): string[] => warn.mock.calls.map(([line]) => String(line));

      it("is not scheduled inside the test app", () => {
        expect(WorkflowManager.getWorkflow(`job-${config.name}`)).toBeUndefined();
      });

      it("discovers and records a shipment in one run and logs what it did", async () => {
        const now = new Date();
        const order = await seedApiOrder();
        await orderIngestion().initializeShipmentPollState(at(now, -120 * MINUTE));
        headers = [header(at(now, -30 * MINUTE))];

        await pollShipmentNoticesJob(getContainer());

        const notices = await orderIngestion().listShipmentNotices({ order_id: order.id });
        expect(notices).toHaveLength(1);
        const summary = infoLines().filter((line) => line.startsWith("Shipment notice poll:"));
        expect(summary).toHaveLength(1);
        expect(summary[0]).toMatch(
          /^Shipment notice poll: duration_ms=\d+ headers=1 matched=1 checked=1 recorded=1 (.*)$/
        );
        expect(summary[0]).toContain("unchanged=0 conflicts=0 errors=0 lead_lag_min=15.");
        expect(summary[0]).toContain("trail_lag_min=45.");
        expect(summary[0]).toContain("backlog_due=0 oldest_due_age_min=0.0");
        expect(warnLines().filter((line) => line.includes("stalled"))).toEqual([]);
      });

      it("warns when the lead scan ends the run more than 60 minutes behind", async () => {
        const now = new Date();
        await orderIngestion().initializeShipmentPollState(at(now, -180 * MINUTE));
        // A header in the lead window, so the scan needs a second BC request to finish it.
        headers = [{ ...header(at(now, -100 * MINUTE)), customerNumber: "C-NOT-AN-API-CUSTOMER" }];
        const pastDeadline = now.getTime() + 5 * MINUTE;
        countShipments.mockImplementation(async (window: BCShipmentWindow) => {
          // The run's clock passes its deadline while the first window is being sized.
          jest.spyOn(Date, "now").mockReturnValue(pastDeadline);
          return inWindow(window).length;
        });

        await pollShipmentNoticesJob(getContainer());

        const stalled = warnLines().filter((line) => line.includes("stalled"));
        expect(stalled).toHaveLength(1);
        expect(stalled[0]).toMatch(/the lead scan is 1[78]\d\.\d minutes behind \(limit 60\)/);
        expect(listShipmentHeaders).not.toHaveBeenCalled();
        expect(getShipmentsByNumbers).not.toHaveBeenCalled();
      });

      it("makes no BC call while a throttling back-off is in force", async () => {
        const now = new Date();
        await seedApiOrder();
        const goLive = at(now, -120 * MINUTE);
        await orderIngestion().initializeShipmentPollState(goLive);
        await orderIngestion().setShipmentPollBackoff(at(now, 10 * MINUTE));
        headers = [header(at(now, -30 * MINUTE))];

        await pollShipmentNoticesJob(getContainer());

        expect(countShipments).not.toHaveBeenCalled();
        expect(listShipmentHeaders).not.toHaveBeenCalled();
        expect(getShipmentsByNumbers).not.toHaveBeenCalled();
        expect(infoLines()).toContain(
          "Shipment notice poll skipped: Business Central back-off in force"
        );
        const state = (await orderIngestion().retrieveShipmentPollState())!;
        expect(state.lead_cursor).toEqual(goLive);
      });

      it("runs again once the previous run has released its lock", async () => {
        await orderIngestion().initializeShipmentPollState(at(new Date(), -120 * MINUTE));

        await pollShipmentNoticesJob(getContainer());
        await pollShipmentNoticesJob(getContainer());

        const summaries = infoLines().filter((line) => line.startsWith("Shipment notice poll:"));
        expect(summaries).toHaveLength(2);
      });
    });
  },
});
