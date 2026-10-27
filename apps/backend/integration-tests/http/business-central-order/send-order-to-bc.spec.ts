import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { SkipExecutionError } from "@medusajs/framework/orchestration";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService, Logger } from "@medusajs/framework/types";
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
  BCItemBarcodeReference,
  BCItemLookupEvidence,
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
import type { CanonicalOrderLine } from "../../../src/modules/order-ingestion/canonical-order-schema";

jest.setTimeout(60 * 1000);

const ITEM_ONE: BCItem = {
  id: "11111111-1111-1111-1111-111111111111",
  number: "NKT-NIM-TELLURIDENA-S",
  displayName: "Telluride Jacket, Unisex, Navy - S",
  gtin: "5712094143628",
  baseUnitOfMeasureCode: "PCS",
  variants: [],
};

const ITEM_TWO: BCItem = {
  id: "33333333-3333-3333-3333-333333333333",
  number: "NKT-NIM-TELLURIDENA-M",
  displayName: "Telluride Jacket, Unisex, Navy - M",
  gtin: "5712094143635",
  baseUnitOfMeasureCode: "PCS",
  variants: [],
};

const NO_EVIDENCE: BCItemLookupEvidence = {
  itemsByBarcode: [],
  barcodeReferences: [],
  itemsByNumber: [],
};

// Items found by their card barcode (gtin), i.e. the fixture lines' EANs.
const byCardBarcode = (...items: BCItem[]): BCItemLookupEvidence => ({
  ...NO_EVIDENCE,
  itemsByBarcode: items,
});

const BOTH_LINES_FOUND = byCardBarcode(ITEM_ONE, ITEM_TWO);

// Shapes from samples/bc-variant-barcodes-testdk.md: a size barcode lives on an Item Reference
// row that names the item and its size, not on the item card.
const SIZE_BARCODE = "5712094132141";

const SIZED_ITEM: BCItem = {
  id: "55555555-5555-5555-5555-555555555555",
  number: "HEND-L-MIDNBLUE",
  displayName: "Hendrix Jacket, Midnight Blue",
  gtin: "",
  baseUnitOfMeasureCode: "PCS",
  variants: [
    { id: "66666666-6666-6666-6666-666666666666", code: "M" },
    { id: "77777777-7777-7777-7777-777777777777", code: "L" },
  ],
};

const SIZE_REFERENCE: BCItemBarcodeReference = {
  barcode: SIZE_BARCODE,
  itemNumber: "HEND-L-MIDNBLUE",
  variantCode: "L",
  unitOfMeasureCode: "PCS",
  referenceType: "bar_code",
};

const SIZE_EVIDENCE: BCItemLookupEvidence = {
  itemsByBarcode: [],
  barcodeReferences: [SIZE_REFERENCE],
  itemsByNumber: [SIZED_ITEM],
};

// The customer's unit in its own spelling: the rule compares it case-insensitively, BC gets it as sent.
const sizeLine: CanonicalOrderLine = {
  lineNumber: 1,
  eanNo: SIZE_BARCODE,
  description: "Hendrix Jacket, Midnight Blue - L",
  quantity: 2,
  unitPrice: 100,
  unitOfMeasureCode: "pcs",
};

const createdSalesOrder = (
  acceptedLineNumbers: number[],
  rejectedLines: BCCreatedSalesOrder["rejectedLines"] = [],
  identity: { id: string; number: string } = {
    id: "22222222-2222-2222-2222-222222222222",
    number: "SO-001234",
  }
): BCCreatedSalesOrder => ({
  ...identity,
  status: "Draft",
  acceptedLineNumbers,
  acceptedLines: acceptedLineNumbers.map((lineNumber) => ({
    lineNumber,
    sequence: lineNumber * 10000,
  })),
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
          lines?: CanonicalOrderLine[];
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
            lines: options.lines ?? multiLineCanonicalOrder.lines,
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
       * Stubs the BC methods on the container-resolved module service (same pattern as
       * integration-tests/http/customers/company-sync.spec.ts). Their HTTP behaviour is covered by
       * the business-central module's fetch-mocked specs.
       */
      function stubBusinessCentral(
        evidence: BCItemLookupEvidence | Error,
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
          evidence instanceof Error
            ? jest.spyOn(bcService, "getItemLookupEvidence").mockRejectedValue(evidence)
            : jest.spyOn(bcService, "getItemLookupEvidence").mockResolvedValue(evidence);
        const createSalesOrder =
          createResult instanceof Error
            ? jest.spyOn(bcService, "createSalesOrder").mockRejectedValue(createResult)
            : jest.spyOn(bcService, "createSalesOrder").mockResolvedValue(createResult);

        return { findItems, createSalesOrder, getCustomer };
      }

      async function run(orderId: string, forceResend = false) {
        await sendOrderToBusinessCentralWorkflow(getContainer()).run({
          input: { order_id: orderId, force_resend: forceResend },
        });
      }

      // An unstubbed BC method must fail the test, never reach a real tenant.
      beforeEach(() => {
        jest
          .spyOn(globalThis, "fetch")
          .mockRejectedValue(new Error("Unexpected outbound request blocked by test"));
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it("TC-1: submits every line, records sent with the real BC order id", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          BOTH_LINES_FOUND,
          createdSalesOrder([1, 2])
        );

        await run(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        // Order submission always goes to the Danish Business Central.
        expect(createSalesOrder.mock.calls[0][0]).toBe("DK");
        const params = createSalesOrder.mock.calls[0][1];
        expect(params.customerNumber).toEqual("579000283084");
        expect(params.externalDocumentNumber).toMatch(/^BC-ORDER-/);
        expect(params.orderDate).toEqual("2026-08-26");
        // Order currency DKK matches the BC customer's DKK: no override is sent.
        expect(params.currencyCode).toBeUndefined();
        expect(params.shipTo).toMatchObject({ name: "JK Tryk", country: "DK" });
        expect(params.lines).toHaveLength(2);
        for (const line of params.lines) {
          expect(Object.keys(line)).not.toContain("unitPrice");
          // Items without sizes are sent without a size.
          expect(line.itemVariantId).toBeUndefined();
        }
        expect(params.lines.map((line) => line.itemId)).toEqual([ITEM_ONE.id, ITEM_TWO.id]);

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
          byCardBarcode(ITEM_ONE),
          createdSalesOrder([1])
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][1].lines).toHaveLength(1);

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
        const { createSalesOrder } = stubBusinessCentral(NO_EVIDENCE, createdSalesOrder([]));

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_id).toBeNull();
        expect(state.failure_reason).toEqual("no_lines_resolved");
        expect(state.attempt_count).toEqual(1);
        expect(state.line_failures.map((failure) => failure.reason)).toEqual([
          "not_found",
          "not_found",
        ]);
      });

      it("sends a size barcode line with its item and size, in the customer's unit", async () => {
        const { order } = await seedOrder({ lines: [sizeLine] });
        const { createSalesOrder, findItems } = stubBusinessCentral(
          SIZE_EVIDENCE,
          createdSalesOrder([1])
        );

        await run(order.id);

        expect(findItems).toHaveBeenCalledTimes(1);
        expect(createSalesOrder.mock.calls[0][1].lines).toEqual([
          {
            lineNumber: 1,
            itemId: SIZED_ITEM.id,
            itemVariantId: "77777777-7777-7777-7777-777777777777",
            quantity: 2,
            unitOfMeasureCode: "pcs",
            shipmentDate: undefined,
          },
        ]);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(false);
        expect(state.bc_lines).toEqual([
          { line_number: 1, ean_no: SIZE_BARCODE, bc_sequence: 10000 },
        ]);
      });

      it("refuses a sized item reached by item number and submits the size barcode line", async () => {
        const { order } = await seedOrder({
          lines: [
            sizeLine,
            {
              lineNumber: 2,
              eanNo: "5712094999999",
              itemNumber: "HEND-L-MIDNBLUE",
              quantity: 1,
            },
          ],
        });
        const { createSalesOrder } = stubBusinessCentral(
          SIZE_EVIDENCE,
          createdSalesOrder([1])
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][1].lines).toEqual([
          expect.objectContaining({ lineNumber: 1, itemVariantId: SIZED_ITEM.variants[1].id }),
        ]);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("sent");
        expect(state.partial).toBe(true);
        expect(state.failure_reason).toEqual("partial_lines_submitted");
        expect(state.line_failures).toEqual([
          {
            line_number: 2,
            ean_no: "5712094999999",
            item_number: "HEND-L-MIDNBLUE",
            cust_item_no: null,
            reason: "size_unresolved",
            message: null,
          },
        ]);
      });

      it("sends no line without its size: an order whose every line is refused creates no BC order", async () => {
        const { order } = await seedOrder({
          lines: [
            { lineNumber: 1, eanNo: "5712094999999", itemNumber: "HEND-L-MIDNBLUE", quantity: 1 },
            { ...sizeLine, lineNumber: 2, unitOfMeasureCode: "BOX" },
          ],
        });
        const { createSalesOrder } = stubBusinessCentral(SIZE_EVIDENCE, createdSalesOrder([]));

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("no_lines_resolved");
        expect(state.line_failures.map((failure) => [failure.line_number, failure.reason])).toEqual([
          [1, "size_unresolved"],
          [2, "unit_mismatch"],
        ]);
      });

      it("TC-4: records failed with no fabricated BC order id when BC rejects the order", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
        const { createSalesOrder } = stubBusinessCentral(NO_EVIDENCE, createdSalesOrder([]));

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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
        const logger = getContainer().resolve<Logger>(ContainerRegistrationKeys.LOGGER);
        const error = jest.spyOn(logger, "error");
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          new Error("Business Central item request failed with status 500"),
          createdSalesOrder([])
        );

        await run(order.id);

        expect(createSalesOrder).not.toHaveBeenCalled();
        // The order id and the error message only: no barcode, item number or customer data.
        expect(error).toHaveBeenCalledWith(
          `Business Central item lookup failed for Medusa order ${order.id}: Business Central item request failed with status 500`
        );

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.failure_reason).toEqual("bc_item_lookup_failed");
        expect(state.attempt_count).toEqual(1);
      });

      it("TC-12: records bc_submission_outcome_unknown for an ambiguous BC outcome", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
          createdSalesOrder([1, 2]),
          bcCustomer("EUR")
        );

        await run(order.id);

        expect(createSalesOrder.mock.calls[0][1].currencyCode).toEqual("DKK");
      });

      it("TC-15: treats a blank BC customer currency as local currency", async () => {
        const originalLcy = process.env.BUSINESS_CENTRAL_LCY_CODE;
        process.env.BUSINESS_CENTRAL_LCY_CODE = "DKK";

        try {
          const { order: dkkOrder } = await seedOrder();
          const { createSalesOrder } = stubBusinessCentral(
            BOTH_LINES_FOUND,
            createdSalesOrder([1, 2]),
            bcCustomer(null)
          );

          await run(dkkOrder.id);
          expect(createSalesOrder.mock.calls[0][1].currencyCode).toBeUndefined();

          const { order: eurOrder } = await seedOrder({ currencyCode: "EUR" });

          await run(eurOrder.id);
          expect(createSalesOrder.mock.calls[1][1].currencyCode).toEqual("EUR");
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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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
          BOTH_LINES_FOUND,
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

      it("records the BC line map with the canonical EAN in the same update as the BC order number", async () => {
        const { order } = await seedOrder();
        stubBusinessCentral(
          BOTH_LINES_FOUND,
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
        expect(state.bc_order_number).toEqual("SO-001234");
        expect(state.bc_lines).toEqual([
          { line_number: 1, ean_no: "5712094143628", bc_sequence: 10000 },
        ]);
      });

      it("replaces the BC order number and the line map together on a force resend", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          BOTH_LINES_FOUND,
          createdSalesOrder([1])
        );

        await run(order.id);
        createSalesOrder.mockResolvedValue(
          createdSalesOrder([1, 2], [], {
            id: "44444444-4444-4444-4444-444444444444",
            number: "SO-005678",
          })
        );
        await run(order.id, true);

        expect(createSalesOrder).toHaveBeenCalledTimes(2);
        const state = await readIntegrationState(order.id);
        expect(state.bc_order_number).toEqual("SO-005678");
        expect(state.bc_lines).toEqual([
          { line_number: 1, ean_no: "5712094143628", bc_sequence: 10000 },
          { line_number: 2, ean_no: "5712094143635", bc_sequence: 20000 },
        ]);
      });

      it("leaves the BC order number and the line map unchanged when a resend fails", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          BOTH_LINES_FOUND,
          createdSalesOrder([1, 2])
        );

        await run(order.id);
        const sentState = await readIntegrationState(order.id);
        createSalesOrder.mockRejectedValue(
          new BusinessCentralAmbiguousOutcomeError("timeout", "BC-ORDER-x")
        );
        await run(order.id, true);

        const state = await readIntegrationState(order.id);
        expect(state.status).toEqual("failed");
        expect(state.bc_order_number).toEqual(sentState.bc_order_number);
        expect(state.bc_lines).toEqual(sentState.bc_lines);
        expect(state.bc_lines).toHaveLength(2);
      });

      it("keeps an ordinary retry after a sent outcome stopped by the duplicate guard", async () => {
        const { order } = await seedOrder();
        const { createSalesOrder } = stubBusinessCentral(
          BOTH_LINES_FOUND,
          createdSalesOrder([1, 2])
        );

        await run(order.id);
        const sentState = await readIntegrationState(order.id);
        await run(order.id);

        expect(createSalesOrder).toHaveBeenCalledTimes(1);
        expect(await readIntegrationState(order.id)).toEqual(sentState);
        expect(sentState.bc_lines).toHaveLength(2);
      });
    });
  },
});
