import {
  shipmentNoticeEnvelopeExample,
} from "../../../modules/order-ingestion/__fixtures__/shipment-notice-fixtures";
import {
  ShipmentNoticeEnvelopeSchema,
  ShipmentNoticePayloadSchema,
} from "../../../modules/order-ingestion/shipment-notice-contract";
import type { ShipmentNoticeRow } from "../../../modules/order-ingestion/shipment-notice-storage";
import {
  companyShipmentNoticeQuery,
  shipmentNoticePage,
} from "../utils/shipment-notice-page";

const {
  cursor: _cursor,
  previous_cursor: _previousCursor,
  recorded_at: _recordedAt,
  revision: _revision,
  status: _status,
  ...examplePayloadFields
} = shipmentNoticeEnvelopeExample.shipment_notices[0];
const PAYLOAD = ShipmentNoticePayloadSchema.parse(examplePayloadFields);

function row(sequence: number, overrides: Partial<ShipmentNoticeRow> = {}): ShipmentNoticeRow {
  return {
    id: `shpn_${sequence}`,
    sequence,
    previous_sequence: null,
    bc_shipment_id: `bc-${sequence}`,
    revision: 1,
    status: "shipped",
    content_hash: "hash",
    company_id: "comp_A",
    order_id: PAYLOAD.order_id,
    external_order_number: PAYLOAD.external_order_number,
    bc_order_number: PAYLOAD.bc_order_number,
    shipment_number: PAYLOAD.shipment_number,
    shipment_date: PAYLOAD.shipment_date,
    bc_last_modified_at: new Date("2026-10-20T07:00:00.000Z"),
    payload: PAYLOAD,
    created_at: new Date("2026-10-20T07:32:05.118Z"),
    ...overrides,
  };
}

describe("shipmentNoticePage", () => {
  it("maps a stored revision to the contract notice, cursors as decimal strings", () => {
    const page = shipmentNoticePage([row(1057, {
      previous_sequence: 1041,
      revision: 2,
      status: "cancelled",
      payload: { ...PAYLOAD, lines: shipmentNoticeEnvelopeExample.shipment_notices[1].lines },
      created_at: new Date("2026-10-21T09:02:47.530Z"),
    })], { limit: 50, after: "1041" });

    expect(ShipmentNoticeEnvelopeSchema.parse(page)).toEqual(page);
    expect(page).toEqual({
      shipment_notices: [shipmentNoticeEnvelopeExample.shipment_notices[1]],
      next_cursor: "1057",
      has_more: false,
    });
  });

  it("keeps only limit rows of the limit + 1 read, sets has_more and the last kept cursor", () => {
    const page = shipmentNoticePage([row(3), row(5), row(9)], { limit: 2, after: null });

    expect(page.shipment_notices.map((notice) => notice.cursor)).toEqual(["3", "5"]);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe("5");
  });

  it("echoes after on an empty page so the caller can always store it", () => {
    expect(shipmentNoticePage([], { limit: 50, after: "1057" })).toEqual({
      shipment_notices: [],
      next_cursor: "1057",
      has_more: false,
    });
  });

  it("returns a null cursor on an empty page when no after was sent", () => {
    expect(shipmentNoticePage([], { limit: 50, after: null }).next_cursor).toBeNull();
  });
});

describe("companyShipmentNoticeQuery", () => {
  it("reads from the start when neither after nor since is given", () => {
    expect(companyShipmentNoticeQuery({
      company_id: "comp_A", limit: 50, after: null, since: null,
    })).toEqual({ company_id: "comp_A", limit: 50, after: 0 });
  });

  it("reads above the cursor when after is given", () => {
    expect(companyShipmentNoticeQuery({
      company_id: "comp_A", limit: 2, after: "1041", since: null,
    })).toEqual({ company_id: "comp_A", limit: 2, after: 1041 });
  });

  it("caps a cursor beyond any stored sequence instead of overflowing the integer column", () => {
    expect(companyShipmentNoticeQuery({
      company_id: "comp_A", limit: 50, after: "999999999999999", since: null,
    })).toEqual({ company_id: "comp_A", limit: 50, after: 2147483647 });
  });

  it("reads recorded at or after the time when since is given", () => {
    expect(companyShipmentNoticeQuery({
      company_id: "comp_A", limit: 50, after: null, since: "2026-10-20T09:32:05+02:00",
    })).toEqual({ company_id: "comp_A", limit: 50, since: new Date("2026-10-20T07:32:05.000Z") });
  });
});
