import {
  halveShipmentWindow,
  shipmentScanBounds,
  shipmentTrackingForHeaders,
} from "../utils/discovery-window";
import type { ShipmentOrderCandidate } from "../utils/match-shipment-order";
import type { BCShipmentHeader } from "../../../modules/business-central/types";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const GO_LIVE = new Date("2026-10-20T09:30:00.000Z");

const header: BCShipmentHeader = {
  id: "bc-shp-1",
  number: "SS-1001",
  orderNumber: "SO-200",
  externalDocumentNumber: "METZ-77",
  customerNumber: "C-100",
  postingDate: "2026-10-21",
  lastModifiedDateTime: "2026-10-21T10:00:00.250Z",
};

const metz: ShipmentOrderCandidate = {
  company_id: "comp_metz",
  business_central_customer_number: "C-100",
  order_id: "order_1",
  external_order_number: "METZ-77",
  bc_state: { bc_order_number: "SO-200" },
};

describe("shipmentScanBounds", () => {
  it("bounds the lead scan 15 minutes and the trail scan 45 minutes before now", () => {
    expect(shipmentScanBounds(NOW)).toEqual({
      lead: new Date("2026-10-21T11:45:00.000Z"),
      trail: new Date("2026-10-21T11:15:00.000Z"),
    });
  });
});

describe("halveShipmentWindow", () => {
  it("returns the end of the lower half of the window", () => {
    const after = new Date("2026-10-21T10:00:00.000Z");
    const until = new Date("2026-10-21T11:00:00.000Z");

    expect(halveShipmentWindow({ after, until })).toEqual(new Date("2026-10-21T10:30:00.000Z"));
  });

  it("halves down to a window of one timestamp", () => {
    const after = new Date("2026-10-21T10:00:00.000Z");

    expect(
      halveShipmentWindow({ after, until: new Date(after.getTime() + 3) })
    ).toEqual(new Date(after.getTime() + 1));
  });

  it("cannot halve a window of one timestamp", () => {
    const after = new Date("2026-10-21T10:00:00.000Z");

    expect(halveShipmentWindow({ after, until: new Date(after.getTime() + 1) })).toBeNull();
  });
});

describe("shipmentTrackingForHeaders", () => {
  it("tracks a matched header for its API order, due 15 minutes after last-modified", () => {
    expect(shipmentTrackingForHeaders([header], [metz], GO_LIVE)).toEqual([
      {
        bc_shipment_id: "bc-shp-1",
        shipment_number: "SS-1001",
        bc_order_number: "SO-200",
        posting_date: "2026-10-21",
        company_id: "comp_metz",
        order_id: "order_1",
        external_order_number: "METZ-77",
        next_check_at: new Date("2026-10-21T10:15:00.250Z"),
        recheck_until: new Date("2026-11-04T23:59:59.999Z"),
      },
    ]);
  });

  it("leaves out headers that match no API order", () => {
    const storefrontOrder = { ...header, id: "bc-shp-2", externalDocumentNumber: "WEB-1" };
    const beforeGoLive = { ...header, id: "bc-shp-3", postingDate: "2026-10-19" };

    expect(shipmentTrackingForHeaders([storefrontOrder, beforeGoLive], [metz], GO_LIVE)).toEqual(
      []
    );
  });
});
