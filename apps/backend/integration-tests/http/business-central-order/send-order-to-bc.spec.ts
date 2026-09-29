import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { SkipExecutionError } from "@medusajs/framework/orchestration";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import {
  getSendOrderToBusinessCentralTransactionId,
  sendOrderToBusinessCentralWorkflow,
} from "../../../src/workflows/business-central-order/workflows/send-order-to-business-central";
import { BUSINESS_CENTRAL_MODULE } from "../../../src/modules/business-central";
import { BusinessCentralAmbiguousOutcomeError } from "../../../src/modules/business-central/service";
import type {
  BCCreatedSalesOrder,
  BCCustomer,
  BCItem,
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
import { multiLineCanonicalOrder } from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

const ITEM_ONE: BCItem = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "NKT-NIM-TELLURIDENA-S",
  displayName: "Telluride Jacket, Unisex, Navy - S",
  gtin: "5712094143628",
  baseUnitOfMeasureCode: "PCS",
};

const ITEM_TWO: BCItem = {
  id: "33333333-3333-3333-3333-333333333333",
  number: "NKT-NIM-TELLURIDENA-M",
  displayName: "Telluride Jacket, Unisex, Navy - M",
  gtin: "5712094143635",
  baseUnitOfMeasureCode: "PCS",
};

const matchedLine = (lineNumber: number, item: BCItem): BCItemLookupResult => ({
  lineNumber,
  matched: true,
  item,
  matchedBy: "eanNo",
});

const unmatchedLine = (lineNumber: number): BCItemLookupResult => ({
  lineNumber,
  matched: false,
  reason: "not_found",
});

const createdSalesOrder = (
  acceptedLineNumbers: number[],
  rejectedLines: BCCreatedSalesOrder["rejectedLines"] = []
): BCCreatedSalesOrder => ({
  id: "22222222-2222-2222-2222-222222222222",
  number: "SO-001234",
  status: "Draft",
  acceptedLineNumbers,
  rejectedLines,
});

function bcCustomer(currencyCode: string | null): BCCustomer {
  return {
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
    currencyCode,
  };
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("sendOrderToBusinessCentralWorkflow", () => {
      let counter = 0;

      /**
       * Creates a company and a header-only order carrying the metadata ingestion writes on
       * develop (company_id, canonical_order, order_ingestion_state, pending BC state). Built via
       * Modules.ORDER directly so individual keys can be omitted for edge cases.
       */
      async function seedOrder(
        options: {
          businessCentralCustomerNumber?: string | null;
          withCanonicalOrder?: boolean;
          currencyCode?: string;
        } = {}
      ) {
        counter += 1;
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        const company = await companyService.createCompanies({
          name: `BC Order Co ${counter}`,
          email: `bc-order-${counter}@example.com`,
          business_central_customer_number:
            options.businessCentralCustomerNumber === undefined
              ? "579000283084"
              : options.businessCentralCustomerNumber,
        });

        const metadata: Record<string, unknown> = {
          company_id: company.id,
          order_ingestion_state: "ready_for_business_central",
          [BC_INTEGRATION_STATE_METADATA_KEY]: createInitialBcIntegrationState(
            "2026-09-29T10:00:00.000Z"
          ),
        };

        if (options.withCanonicalOrder !== false) {
          metadata.canonical_order = {
            ...multiLineCanonicalOrder,
            externalOrderNumber: `BC-ORDER-${counter}`,
            currencyCode: options.currencyCode ?? multiLineCanonicalOrder.currencyCode,
          };
        }

        const order = await orderModuleService.createOrders({
          currency_code: "dkk",
          metadata,
        });

        return { company, order };
      }

      async function readIntegrationState(
        orderId: string
      ): Promise<BcIntegrationState> {
        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(orderId, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        return metadata[BC_INTEGRATION_STATE_METADATA_KEY] as BcIntegrationState;
      }

      /**
       * Stubs the two BC methods on the container-resolved module service (same pattern as
       * integration-tests/http/customers/company-sync.spec.ts). The HTTP behaviour of those methods
       * is covered by Tasks 02/03's fetch-mocked specs.
       */
      function stubBusinessCentral(
        lookupResults: BCItemLookupResult[] | Error,
        createResult: BCCreatedSalesOrder | Error,
        customer: BCCustomer | null | Error = bcCustomer("DKK")
      ) {
        const bcService = getContainer().resolve<IBusinessCentralModuleService>(
          BUSINESS_CENTRAL_MODULE
        );
        const getCustomer =
          customer instanceof Error
            ? jest.spyOn(bcService, "getCustomer").mockRejectedValue(customer)
            : jest.spyOn(bcService, "getCustomer").mockResolvedValue(customer);
        const findItems =
          lookupResults instanceof Error
            ? jest
                .spyOn(bcService, "findItemsForOrderLines")
                .mockRejectedValue(lookupResults)
            : jest
                .spyOn(bcService, "findItemsForOrderLines")
                .mockResolvedValue(lookupResults);
        const createSalesOrder =
          createResult instanceof Error
            ? jest.spyOn(bcService, "createSalesOrder").mockRejectedValue(createResult)
            : jest.spyOn(bcService, "createSalesOrder").mockResolvedValue(createResult);

        return { findItems, createSalesOrder, getCustomer };
      }

      async function run(orderId: string) {
        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: orderId },
        });
      }

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: submits every line, records sent with the real BC order id", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        const params = createSalesOrder.mock.calls[0][0];
        expect(params.customerNumber).toEqual("579000283084");
        expect(params.externalDocumentNumber).toMatch(/^BC-ORDER-/);
        expect(params.orderDate).toEqual("2026-08-26");
        // Order currency DKK matches the BC customer's DKK: no override is sent.
        expect(params.currencyCode).toBeUndefined();
        expect(params.shipTo).toMatchObject({ name: "JK Tryk", country: "DK" });
        expect(params.lines).toHaveLength(2);
        for (const line of params.lines) {
          expect(Object.keys(line)).not.toContain("unitPrice");
        }

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.bc_order_id).toEqual("22222222-2222-2222-2222-222222222222");
        expect(state.bc_order_number).toEqual("SO-001234");
        expect(state.attempt_count).toEqual(1);
        expect(state.partial).toBe(false);
        expect(state.failure_reason).toBeNull();
        expect(state.line_failures).toEqual([]);
        expect(state.sent_at).not.toBeNull();
        expect(state.last_attempt_at).not.toBeNull();
        expect(state.initialized_at).toEqual("2026-09-29T10:00:00.000Z");
      });

      it("TC-2: submits the resolved subset and records both failure levels", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), unmatchedLine(2)],
          createdSalesOrder([1])
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][0].lines).toHaveLength(1);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(true);
        expect(state.failure_reason).toEqual("partial_lines_submitted");
        expect(state.line_failures).toEqual([
          {
            line_number: 2,
            ean_no: "5712094143635",
            item_number: "NKT-NIM-TELLURIDENA-M",
            cust_item_no: "NKT-NIM-TELLURIDENA-M",
            reason: "not_found",
            message: null,
          },
        ]);
      });

      it("TC-3: creates no BC order at all when zero lines resolve", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [unmatchedLine(1), unmatchedLine(2)],
          createdSalesOrder([])
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.failure_reason).toEqual("no_lines_resolved");
        expect(state.attempt_count).toEqual(1);
        expect(state.line_failures).toHaveLength(2);
      });

      it("TC-4: records failed with no fabricated BC order id when BC rejects the order", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new Error("Business Central sales order request failed with status 422")
        );

        await run(order.id);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.bc_order_number).toBeNull();
        expect(state.failure_reason).toEqual("bc_submission_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-5: increments the attempt count on every repeated invocation", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new Error("boom")
        );

        let previousAttemptAt = "";

        for (const expectedAttempt of [1, 2, 3]) {
          await run(order.id);

          const state = await readIntegrationState(order.id);
          expect(state.attempt_count).toEqual(expectedAttempt);
          expect(state.last_attempt_at).not.toBeNull();
          expect((state.last_attempt_at ?? "") >= previousAttemptAt).toBe(true);
          previousAttemptAt = state.last_attempt_at ?? "";
        }
      });

      it("TC-6: does not create a second BC order when invoked twice for the same order", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);
        const firstState = await readIntegrationState(order.id);

        await run(order.id);
        const secondState = await readIntegrationState(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        expect(secondState).toEqual(firstState);
        expect(secondState.attempt_count).toEqual(1);
      });

      it("TC-7: records failed rather than leaving pending when the canonical payload is missing", async () => {
        const { order } = await seedOrder({ withCanonicalOrder: false });
        const { createSalesOrder } = stubBusinessCentral([], createdSalesOrder([]));

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("canonical_payload_unavailable");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-8: records failed when the matched company has no BC customer number", async () => {
        const { order } = await seedOrder({ businessCentralCustomerNumber: null });
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_customer_number_missing");
      });

      it("TC-9: rejects for an order id that does not exist", async () => {
        await expect(
          sendOrderToBusinessCentralWorkflow(getContainer()).run({
            input: { order_id: "order_does_not_exist" },
          })
        ).rejects.toMatchObject({
          type: "not_found",
          message: expect.stringContaining("was not found"),
        });
      });

      it("TC-10: preserves every other metadata key when recording the outcome", async () => {
        const { company, order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );

        await run(order.id);

        const orderModuleService = getContainer().resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const persisted = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        const metadata = (persisted.metadata ?? {}) as Record<string, unknown>;

        expect(metadata.company_id).toEqual(company.id);
        expect(metadata.order_ingestion_state).toEqual("ready_for_business_central");
        expect(metadata.canonical_order).toEqual(order.metadata?.canonical_order);
      });

      it("TC-11: records bc_item_lookup_failed when the item lookup request fails", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          new Error("Business Central item request failed with status 500"),
          createdSalesOrder([])
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_item_lookup_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-12: records bc_submission_outcome_unknown for an ambiguous BC outcome", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new BusinessCentralAmbiguousOutcomeError("timeout", "BC-ORDER-x")
        );

        await run(order.id);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.failure_reason).toEqual("bc_submission_outcome_unknown");
      });

      it("TC-13: records a BC-rejected line with that line's identifiers", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder(
            [1],
            [
              {
                lineNumber: 2,
                message: "Business Central rejected the sales order line with status 400",
              },
            ]
          )
        );

        await run(order.id);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(true);
        expect(state.line_failures).toEqual([
          {
            line_number: 2,
            ean_no: "5712094143635",
            item_number: "NKT-NIM-TELLURIDENA-M",
            cust_item_no: "NKT-NIM-TELLURIDENA-M",
            reason: "rejected_by_bc",
            message: "Business Central rejected the sales order line with status 400",
          },
        ]);
      });

      it("TC-14: sends the order currency as an override when it differs from the BC customer's", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2]),
          bcCustomer("EUR")
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][0].currencyCode).toEqual("DKK");
      });

      it("TC-15: treats a blank BC customer currency as local currency", async () => {
        const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;
        process.env.BUSINESS_CENTRAL_LCY_CODE = "DKK";

        try {
          const { order: dkkOrder } = await seedOrder();
          const { createSalesOrder } = stubBusinessCentral(
            [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
            createdSalesOrder([1, 2]),
            bcCustomer(null)
          );

          await run(dkkOrder.id);
          expect(createSalesOrder.mock.calls[0][0].currencyCode).toBeUndefined();

          const { order: eurOrder } = await seedOrder({ currencyCode: "EUR" });

          await run(eurOrder.id);
          expect(createSalesOrder.mock.calls[1][0].currencyCode).toEqual("EUR");
        } finally {
          if (originalLcy === undefined) {
            delete process.env.BUSINESS_CENTRAL_LCY_CODE;
          } else {
            process.env.BUSINESS_CENTRAL_LCY_CODE = originalLcy;
          }
        }
      });

      it("TC-16: records bc_customer_not_found when BC has no such customer", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder, findItems } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2]),
          null
        );

        await run(order.id);

        expect(findItems).not.toHaveBeenCalled();
        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_customer_not_found");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-17: records bc_customer_lookup_failed when the BC customer request fails", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2]),
          new Error("Business Central customer request failed with status 500")
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_customer_lookup_failed");
      });

      it("TC-18: runs only once when two runs for the same order overlap", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          createdSalesOrder([1, 2])
        );
        createSalesOrder.mockImplementation(async () => {
          await new Promise((resolve) => setImmediate(resolve));
          return createdSalesOrder([1, 2]);
        });
        const transactionId = getSendOrderToBusinessCentralTransactionId(order.id);

        const results = await Promise.allSettled([
          sendOrderToBusinessCentralWorkflow(getContainer()).run({
            input: { order_id: order.id },
            context: { transactionId },
          }),
          sendOrderToBusinessCentralWorkflow(getContainer()).run({
            input: { order_id: order.id },
            context: { transactionId },
          }),
        ]);

        expect(results.map((result) => result.status).sort()).toEqual([
          "fulfilled",
          "rejected",
        ]);
        const refused = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        expect(SkipExecutionError.isSkipExecutionError(refused?.reason)).toBe(true);
        expect(createSalesOrder).toHaveBeenCalledTimes(1);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-19: lets a later run with the same transaction id retry a failed order", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          [matchedLine(1, ITEM_ONE), matchedLine(2, ITEM_TWO)],
          new Error("Business Central sales order request failed with status 400")
        );
        const transactionId = getSendOrderToBusinessCentralTransactionId(order.id);

        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
          context: { transactionId },
        });
        createSalesOrder.mockResolvedValue(createdSalesOrder([1, 2]));
        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: order.id },
          context: { transactionId },
        });

        expect(createSalesOrder).toHaveBeenCalledTimes(2);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.attempt_count).toEqual(2);
      });
    });
  },
});
