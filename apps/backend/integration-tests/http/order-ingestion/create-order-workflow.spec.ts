import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import { createOrderFromCanonicalPayloadWorkflow } from "../../../src/workflows/order-ingestion/workflows/create-order-from-canonical-payload";
import { createIngestedOrderStep } from "../../../src/workflows/order-ingestion/steps/create-ingested-order";
import type { CreateIngestedOrderInput } from "../../../src/workflows/order-ingestion/steps/create-ingested-order";
import { createOrderExternalReferenceStep } from "../../../src/workflows/order-ingestion/steps/create-order-external-reference";
import type { CanonicalOrder } from "../../../src/modules/order-ingestion/canonical-order-schema";
import { CanonicalOrderSchema } from "../../../src/modules/order-ingestion/canonical-order-schema";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  createInitialBcIntegrationState,
} from "../../../src/modules/order-ingestion/bc-integration-state";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  multiLineCanonicalOrder,
  singleLineCanonicalOrder,
  sampleCustomerNumber,
} from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

// Test-only probe: the production step sequence WITHOUT the duplicate-check step, so the
// reference insert can be made to fail deterministically after the order already exists.
const rollbackProbeWorkflow = createWorkflow(
  "nimbus-149-rollback-probe",
  function (input: CreateIngestedOrderInput) {
    const order = createIngestedOrderStep(input);

    const linkData = transform({ order, input }, (data) => [
      {
        [Modules.ORDER]: { order_id: data.order.id },
        [COMPANY_MODULE]: { company_id: data.input.companyId },
      },
    ]);
    createRemoteLinkStep(linkData);

    const referenceInput = transform({ order, input }, (data) => ({
      external_order_number: data.input.canonicalOrder.externalOrderNumber,
      company_id: data.input.companyId,
      order_id: data.order.id,
    }));
    createOrderExternalReferenceStep(referenceInput);

    return new WorkflowResponse(order);
  }
);

async function listOrdersForExternalNumber(
  orderModuleService: IOrderModuleService,
  externalOrderNumber: string
) {
  const orders = await orderModuleService.listOrders(
    {},
    { select: ["id", "metadata"], take: 1000 }
  );

  // Test-only JS filter: the order has no native external-number column.
  return orders.filter(
    (order) =>
      (order.metadata?.canonical_order as CanonicalOrder | undefined)
        ?.externalOrderNumber === externalOrderNumber
  );
}

/*
  Note on the rejection assertions below: the workflow engine rejects with a serialized plain
  object rather than the original MedusaError instance, so `.rejects.toThrow()` does not match.
  The `type` discriminator survives, which is what Medusa's HTTP error handler keys off
  (`err.type || err.name`) to map these to 404/422 — see the route's HTTP tests.
*/
medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("createOrderFromCanonicalPayloadWorkflow", () => {
      it("TC-1: creates a header-only order, links it to the matched company, and records the external reference (happy path)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const orderIngestionService =
          container.resolve<OrderIngestionModuleService>(
            ORDER_INGESTION_MODULE
          );

        const company = await companyService.createCompanies({
          name: "TC-1 Company",
          email: "tc1@example.com",
          business_central_customer_number: sampleCustomerNumber,
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: sampleCustomerNumber,
            canonicalOrder: singleLineCanonicalOrder,
          },
        });

        expect(order.currency_code).toEqual("dkk");
        expect(order.metadata?.company_id).toEqual(company.id);
        expect(order.metadata?.order_ingestion_state).toEqual("created");

        const persistedOrder = await orderModuleService.retrieveOrder(order.id);
        expect(persistedOrder.id).toEqual(order.id);

        const references =
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "FLS190518",
            company_id: company.id,
          });
        expect(references).toHaveLength(1);
        expect(references[0].order_id).toEqual(order.id);
      });

      it("TC-2: rejects with a 404-mapped NOT_FOUND error when the customer_number matches no company", async () => {
        const container = getContainer();

        await expect(
          createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: "no-such-customer-number",
              canonicalOrder: {
                ...singleLineCanonicalOrder,
                externalOrderNumber: "UNKNOWN-CUST-1",
              },
            },
          })
        ).rejects.toMatchObject({
          type: "not_found",
          message: expect.stringContaining("No company found"),
        });
      });

      it("TC-3: rejects a second submission of the same externalOrderNumber for the same company with a DUPLICATE_ERROR (per-company duplicate rule)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);

        await companyService.createCompanies({
          name: "TC-3 Company",
          email: "tc3@example.com",
          business_central_customer_number: "tc3-customer-number",
        });

        const payload = {
          ...singleLineCanonicalOrder,
          externalOrderNumber: "DUP-ORDER-1",
        };

        await createOrderFromCanonicalPayloadWorkflow(container).run({
          input: {
            customer_number: "tc3-customer-number",
            canonicalOrder: payload,
          },
        });

        await expect(
          createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: "tc3-customer-number",
              canonicalOrder: payload,
            },
          })
        ).rejects.toMatchObject({
          type: "duplicate_error",
          message: expect.stringContaining("already accepted"),
        });
      });

      it("TC-4: does NOT treat the same externalOrderNumber as a duplicate across two different companies (integration/wiring: confirms per-company scoping end to end)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);

        await companyService.createCompanies({
          name: "TC-4 Company A",
          email: "tc4a@example.com",
          business_central_customer_number: "tc4-customer-a",
        });
        await companyService.createCompanies({
          name: "TC-4 Company B",
          email: "tc4b@example.com",
          business_central_customer_number: "tc4-customer-b",
        });

        const payload = {
          ...singleLineCanonicalOrder,
          externalOrderNumber: "CROSS-COMPANY-2",
        };

        const { result: orderA } =
          await createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: "tc4-customer-a",
              canonicalOrder: payload,
            },
          });
        const { result: orderB } =
          await createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: "tc4-customer-b",
              canonicalOrder: payload,
            },
          });

        expect(orderA.id).not.toEqual(orderB.id);
      });

      it("TC-5: rolls back the created order when a later step fails (failure handling: no orphaned order)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const orderIngestionService =
          container.resolve<OrderIngestionModuleService>(
            ORDER_INGESTION_MODULE
          );

        const company = await companyService.createCompanies({
          name: "TC-5 Company",
          email: "tc5@example.com",
          business_central_customer_number: "tc5-customer-number",
        });

        await orderIngestionService.createOrderExternalReferences({
          external_order_number: "ROLLBACK-1",
          company_id: company.id,
          order_id: "order_preexisting",
        });

        await expect(
          rollbackProbeWorkflow(container).run({
            input: {
              companyId: company.id,
              canonicalOrder: {
                ...singleLineCanonicalOrder,
                externalOrderNumber: "ROLLBACK-1",
              },
            },
          })
        ).rejects.toBeDefined();

        expect(
          await listOrdersForExternalNumber(orderModuleService, "ROLLBACK-1")
        ).toHaveLength(0);

        const references =
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "ROLLBACK-1",
            company_id: company.id,
          });
        expect(references).toHaveLength(1);
        expect(references[0].order_id).toEqual("order_preexisting");
      });

      it("TC-6: two concurrent identical submissions create exactly one order (idempotency under concurrency)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );
        const orderIngestionService =
          container.resolve<OrderIngestionModuleService>(
            ORDER_INGESTION_MODULE
          );

        const company = await companyService.createCompanies({
          name: "TC-6 Company",
          email: "tc6@example.com",
          business_central_customer_number: "tc6-customer-number",
        });

        const input = {
          customer_number: "tc6-customer-number",
          canonicalOrder: {
            ...singleLineCanonicalOrder,
            externalOrderNumber: "RACE-1",
          },
        };

        const results = await Promise.allSettled([
          createOrderFromCanonicalPayloadWorkflow(container).run({ input }),
          createOrderFromCanonicalPayloadWorkflow(container).run({ input }),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected"
        );
        expect(rejected).toHaveLength(1);
        // Whether the loser is caught by the pre-check or by the unique index, the caller sees
        // the same duplicate error — never the mapped DB error with the internal company id.
        expect(rejected[0].reason).toMatchObject({
          type: "duplicate_error",
          message: expect.stringContaining("already accepted"),
        });

        const references =
          await orderIngestionService.listOrderExternalReferences({
            external_order_number: "RACE-1",
            company_id: company.id,
          });
        expect(references).toHaveLength(1);
        expect(
          await listOrdersForExternalNumber(orderModuleService, "RACE-1")
        ).toHaveLength(1);
      });

      it("TC-10: links a second order with a new externalOrderNumber to the same company (a company has many orders)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const query = container.resolve("query");

        const company = await companyService.createCompanies({
          name: "TC-10 Company",
          email: "tc10@example.com",
          business_central_customer_number: "tc10-customer-number",
        });

        for (const externalOrderNumber of ["MANY-1", "MANY-2"]) {
          await createOrderFromCanonicalPayloadWorkflow(container).run({
            input: {
              customer_number: "tc10-customer-number",
              canonicalOrder: { ...singleLineCanonicalOrder, externalOrderNumber },
            },
          });
        }

        const { data: companies } = await query.graph({
          entity: "company",
          fields: ["id", "orders.id"],
          filters: { id: company.id },
        });
        expect(companies[0].orders).toHaveLength(2);
      });

      it("TC-7: initializes the Business Central integration state under its own metadata key (NIMBUS-149 contract)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-7 Company",
          email: "tc7@example.com",
          business_central_customer_number: "tc7-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc7-customer-number",
            canonicalOrder: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "BC-STATE-1",
            },
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          select: ["id", "metadata"],
        });
        const metadata = persisted.metadata ?? {};

        expect(metadata[BC_INTEGRATION_STATE_METADATA_KEY]).toEqual(
          createInitialBcIntegrationState(
            metadata.order_ingestion_state_updated_at as string
          )
        );
        expect(metadata.canonical_order).toBeDefined();
        expect(metadata).not.toHaveProperty("bc_integration_state");
      });

      it("TC-8: maps shipTo onto the order's shipping address, creates no line items, and keeps the canonical payload verbatim", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-8 Company",
          email: "tc8@example.com",
          business_central_customer_number: "tc8-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc8-customer-number",
            canonicalOrder: multiLineCanonicalOrder,
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address", "items"],
        });

        expect(persisted.shipping_address).toEqual(
          expect.objectContaining({
            company: "JK Tryk",
            first_name: "3. Parts Nimbus",
            address_1: "Industrikrogen 11B",
            city: "Rønnede",
            postal_code: "4683",
            country_code: "dk",
          })
        );
        expect(persisted.billing_address ?? null).toBeNull();
        expect(persisted.items ?? []).toHaveLength(0);
        expect(persisted.metadata?.canonical_order).toEqual(
          multiLineCanonicalOrder
        );
      });

      it("TC-9: creates the order without addresses when the canonical order has none", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-9 Company",
          email: "tc9@example.com",
          business_central_customer_number: "tc9-customer-number",
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc9-customer-number",
            canonicalOrder: {
              ...singleLineCanonicalOrder,
              externalOrderNumber: "NO-ADDRESS-1",
            },
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address"],
        });

        expect(persisted.currency_code).toEqual("dkk");
        expect(persisted.shipping_address ?? null).toBeNull();
        expect(persisted.billing_address ?? null).toBeNull();
      });

      it("TC-11: persists both addresses from a schema-normalized payload with lower-case country codes (NIMBUS-171)", async () => {
        const container = getContainer();
        const companyService =
          container.resolve<ICompanyModuleService>(COMPANY_MODULE);
        const orderModuleService = container.resolve<IOrderModuleService>(
          Modules.ORDER
        );

        await companyService.createCompanies({
          name: "TC-11 Company",
          email: "tc11@example.com",
          business_central_customer_number: "tc11-customer-number",
        });

        const address = {
          name: "METZ A/S",
          addressLine1: "Skelstedet 9",
          city: "Vedbæk",
          postCode: "2950",
        };
        const canonicalOrder = CanonicalOrderSchema.parse({
          ...singleLineCanonicalOrder,
          externalOrderNumber: "COUNTRY-WORKFLOW-1",
          billTo: { ...address, country: "dk " },
          shipTo: { ...address, country: "\tNo" },
        });

        const { result: order } = await createOrderFromCanonicalPayloadWorkflow(
          container
        ).run({
          input: {
            customer_number: "tc11-customer-number",
            canonicalOrder,
          },
        });

        const persisted = await orderModuleService.retrieveOrder(order.id, {
          relations: ["shipping_address", "billing_address"],
        });

        expect(persisted.billing_address?.country_code).toEqual("dk");
        expect(persisted.shipping_address?.country_code).toEqual("no");
        expect(
          (persisted.metadata?.canonical_order as CanonicalOrder | undefined)
            ?.billTo?.country
        ).toEqual("DK");
      });
    });
  },
});
