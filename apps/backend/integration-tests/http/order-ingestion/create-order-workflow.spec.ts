import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { createOrderFromCanonicalPayloadWorkflow } from "../../../src/workflows/order-ingestion/workflows/create-order-from-canonical-payload";
import { ORDER_INGESTION_MODULE } from "../../../src/modules/order-ingestion";
import type OrderIngestionModuleService from "../../../src/modules/order-ingestion/service";
import { COMPANY_MODULE } from "../../../src/modules/company";
import type { ICompanyModuleService } from "../../../src/types";
import {
  singleLineCanonicalOrder,
  sampleCustomerNumber,
} from "../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures";

jest.setTimeout(60 * 1000);

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
    });
  },
});
