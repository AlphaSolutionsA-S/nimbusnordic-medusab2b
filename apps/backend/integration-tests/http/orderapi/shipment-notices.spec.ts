import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import type { MedusaContainer } from "@medusajs/framework/types";
import {
  createApiCustomerCompany,
  EXAMPLE_SHIPMENT_NOTICE_PAYLOAD,
  orderApiSecretHeaders,
  storeShipmentNoticeRevision,
} from "../../utils/shipment-notices";

jest.setTimeout(120 * 1000);

const PATH = "/orderapi/shipment-notices";
const CUSTOMER = "notices-http-customer";
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DECIMAL = /^[1-9]\d*$/;

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("GET /orderapi/shipment-notices", () => {
      let container: MedusaContainer;
      let headers: { authorization: string };
      /** Company A's sequences, oldest first: shipment 1 r1, shipment 2 r1, shipment 1 r2. */
      let sequences: number[];

      const get = (query: string) => api.get(
        `${PATH}?customerNumber=${CUSTOMER}${query}`, { headers, validateStatus: () => true });

      beforeEach(async () => {
        container = getContainer();
        headers = await orderApiSecretHeaders(container);
        const companyA = await createApiCustomerCompany(container, CUSTOMER);
        const companyB = await createApiCustomerCompany(container, "notices-http-other");
        const store = (company_id: string, bc_shipment_id: string, revision: number) =>
          storeShipmentNoticeRevision(container, { company_id, bc_shipment_id, revision });

        const a1 = await store(companyA, "ship-a1", 1);
        await store(companyB, "ship-b1", 1);
        const a2 = await store(companyA, "ship-a2", 1);
        const a1r2 = await store(companyA, "ship-a1", 2);
        sequences = [a1, a2, a1r2];
      });

      it("pages oldest first with has_more and next_cursor, then the last row", async () => {
        const first = await get("&limit=2");
        expect(first.status).toBe(200);
        expect(first.data.shipment_notices.map((notice) => notice.cursor))
          .toEqual(sequences.slice(0, 2).map(String));
        expect(first.data.has_more).toBe(true);
        expect(first.data.next_cursor).toBe(String(sequences[1]));

        const second = await get(`&limit=2&after=${first.data.next_cursor}`);
        expect(second.status).toBe(200);
        expect(second.data).toEqual({
          shipment_notices: [expect.objectContaining({ cursor: String(sequences[2]) })],
          next_cursor: String(sequences[2]),
          has_more: false,
        });
      });

      it("returns every notice and line field with the type the customer reads", async () => {
        const response = await get("");
        expect(response.status).toBe(200);
        expect(Object.keys(response.data).sort())
          .toEqual(["has_more", "next_cursor", "shipment_notices"]);

        const [first, , revised] = response.data.shipment_notices;
        expect(first).toEqual({
          ...EXAMPLE_SHIPMENT_NOTICE_PAYLOAD,
          cursor: String(sequences[0]),
          previous_cursor: null,
          recorded_at: expect.stringMatching(ISO_UTC),
          revision: 1,
          status: "shipped",
        });
        expect(revised).toMatchObject({
          cursor: expect.stringMatching(DECIMAL),
          previous_cursor: String(sequences[0]),
          revision: 2,
          status: "revised",
        });
        // Integers stay JSON numbers, empty values stay null (not omitted, not strings).
        const [matched, unmatched] = first.lines;
        expect([matched.line_number, matched.bc_line_number, matched.quantity])
          .toEqual([1, 10000, 12]);
        expect(Number.isInteger(first.revision)).toBe(true);
        expect(unmatched).toMatchObject({ line_number: null, ean_no: null, description_2: null });
        expect(first.sell_to).toMatchObject({ address_line_2: null, state: null });
      });

      it("lists notices recorded at or after since, and none from a future time", async () => {
        const all = await get(`&since=${encodeURIComponent("2000-01-01T00:00:00+01:00")}`);
        expect(all.status).toBe(200);
        expect(all.data.shipment_notices.map((notice) => notice.cursor))
          .toEqual(sequences.map(String));

        const future = await get(`&since=${encodeURIComponent("2999-01-01T00:00:00Z")}`);
        expect(future.status).toBe(200);
        expect(future.data).toEqual({ shipment_notices: [], next_cursor: null, has_more: false });
      });

      it.each([
        ["the last cursor", () => String(sequences[2])],
        ["a cursor beyond any stored one", () => "999999999999999"],
      ])("echoes after on an empty page for %s", async (_label, cursor) => {
        const response = await get(`&after=${cursor()}`);
        expect(response.status).toBe(200);
        expect(response.data)
          .toEqual({ shipment_notices: [], next_cursor: cursor(), has_more: false });
      });

      it("returns the same page when called twice", async () => {
        const first = await get("&limit=2");
        const second = await get("&limit=2");
        expect(second.status).toBe(200);
        expect(second.data).toEqual(first.data);
      });

      it.each([
        ["after with since", `&after=1&since=${encodeURIComponent("2026-10-20T00:00:00Z")}`],
        ["limit 0", "&limit=0"],
        ["limit 201", "&limit=201"],
        ["a non-numeric after", "&after=abc"],
        ["an after longer than 15 digits", "&after=1234567890123456"],
        ["a since without a time zone", "&since=2026-10-20T00:00:00"],
        ["an extra parameter", "&company_id=other"],
      ])("rejects %s with 400 and Medusa's error body", async (_label, query) => {
        const response = await get(query);
        expect(response.status).toBe(400);
        expect(response.data).toEqual({ type: "invalid_data", message: expect.any(String) });
      });
    });
  },
});
