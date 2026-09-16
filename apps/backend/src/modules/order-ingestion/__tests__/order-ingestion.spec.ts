import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { ORDER_INGESTION_MODULE } from "../index";
import OrderIngestionModuleService from "../service";

moduleIntegrationTestRunner<OrderIngestionModuleService>({
  moduleName: ORDER_INGESTION_MODULE,
  resolve: "./src/modules/order-ingestion",
  testSuite: ({ service }) => {
    describe("OrderIngestionModuleService", () => {
      it("TC-1: creates and retrieves an order external reference (happy path)", async () => {
        const created = await service.createOrderExternalReferences({
          external_order_number: "NKT004061",
          company_id: "comp_123",
          order_id: "order_123",
        });

        expect(created.id).toEqual(expect.stringMatching(/^oref_/));

        const retrieved = await service.retrieveOrderExternalReference(
          created.id
        );
        expect(retrieved.external_order_number).toEqual("NKT004061");
        expect(retrieved.company_id).toEqual("comp_123");
        expect(retrieved.order_id).toEqual("order_123");
      });

      it("TC-2: lists references filtered by (external_order_number, company_id) — the exact lookup Task 03 uses for the duplicate check", async () => {
        await service.createOrderExternalReferences({
          external_order_number: "FLS190518",
          company_id: "comp_A",
          order_id: "order_A",
        });
        await service.createOrderExternalReferences({
          external_order_number: "FLS190518",
          company_id: "comp_B",
          order_id: "order_B",
        });

        const matchesForA = await service.listOrderExternalReferences({
          external_order_number: "FLS190518",
          company_id: "comp_A",
        });

        expect(matchesForA).toHaveLength(1);
        expect(matchesForA[0].order_id).toEqual("order_A");
      });

      it("TC-3: confirms the same external_order_number across two different companies produces two independent rows (edge case: per-company scoping, not a global uniqueness)", async () => {
        await service.createOrderExternalReferences({
          external_order_number: "CROSS-COMPANY-1",
          company_id: "comp_A",
          order_id: "order_A2",
        });
        await service.createOrderExternalReferences({
          external_order_number: "CROSS-COMPANY-1",
          company_id: "comp_B",
          order_id: "order_B2",
        });

        const all = await service.listOrderExternalReferences({
          external_order_number: "CROSS-COMPANY-1",
        });

        expect(all).toHaveLength(2);
      });
    });
  },
});
