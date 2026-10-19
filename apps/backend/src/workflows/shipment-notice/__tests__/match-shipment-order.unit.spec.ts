import {
  isCurrentBcOrder,
  matchShipmentToOrder,
  type ShipmentOrderCandidate,
} from "../utils/match-shipment-order";
import type { BCShipmentHeader } from "../../../modules/business-central/types";
import {
  createInitialBcIntegrationState,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";

const GO_LIVE = new Date("2026-10-20T09:30:00.000Z");

const header: BCShipmentHeader = {
  id: "bc-shp-1",
  number: "SS-1001",
  orderNumber: "SO-200",
  externalDocumentNumber: "METZ-77",
  customerNumber: "C-100",
  postingDate: "2026-10-21",
  lastModifiedDateTime: "2026-10-21T10:00:00Z",
};

function stateWith(bcOrderNumber: string | null) {
  return parseBcIntegrationState({
    ...createInitialBcIntegrationState("2026-10-19T00:00:00.000Z"),
    status: "sent",
    bc_order_number: bcOrderNumber,
  });
}

const metz: ShipmentOrderCandidate = {
  company_id: "comp_metz",
  business_central_customer_number: "C-100",
  order_id: "order_1",
  external_order_number: "METZ-77",
  bc_state: stateWith("SO-200"),
};

describe("matchShipmentToOrder", () => {
  it("matches the API order of the shipment's company, external number and current BC number", () => {
    expect(matchShipmentToOrder(header, [metz], GO_LIVE)).toBe(metz);
  });

  it("does not match a shipment under an earlier BC order number (force resend)", () => {
    const resent = { ...metz, bc_state: stateWith("SO-300") };
    expect(matchShipmentToOrder(header, [resent], GO_LIVE)).toBeNull();
  });

  it("does not match another company's order with the same external number", () => {
    const other: ShipmentOrderCandidate = {
      ...metz,
      company_id: "comp_other",
      business_central_customer_number: "C-999",
      order_id: "order_other",
    };
    expect(matchShipmentToOrder(header, [other], GO_LIVE)).toBeNull();
  });

  it("picks the order of the shipment's own company among several candidates", () => {
    const other: ShipmentOrderCandidate = {
      ...metz,
      company_id: "comp_other",
      business_central_customer_number: "C-999",
      order_id: "order_other",
    };
    expect(matchShipmentToOrder(header, [other, metz], GO_LIVE)?.order_id).toBe("order_1");
  });

  it("does not match a different external number", () => {
    const shipment = { ...header, externalDocumentNumber: "METZ-78" };
    expect(matchShipmentToOrder(shipment, [metz], GO_LIVE)).toBeNull();
  });

  it("does not match a shipment posted before the go-live day", () => {
    const shipment = { ...header, postingDate: "2026-10-19" };
    expect(matchShipmentToOrder(shipment, [metz], GO_LIVE)).toBeNull();
  });

  it("matches a shipment posted on the go-live day itself (day granularity)", () => {
    const shipment = { ...header, postingDate: "2026-10-20" };
    expect(matchShipmentToOrder(shipment, [metz], GO_LIVE)).toBe(metz);
  });

  it("does not match a header with no order number, customer number or posting date", () => {
    expect(matchShipmentToOrder({ ...header, orderNumber: null }, [metz], GO_LIVE)).toBeNull();
    expect(matchShipmentToOrder({ ...header, customerNumber: null }, [metz], GO_LIVE)).toBeNull();
    expect(matchShipmentToOrder({ ...header, postingDate: null }, [metz], GO_LIVE)).toBeNull();
  });

  it("does not match an order that has no BC order number (never sent)", () => {
    const unsent = { ...metz, bc_state: stateWith(null) };
    expect(matchShipmentToOrder(header, [unsent], GO_LIVE)).toBeNull();
  });
});

describe("isCurrentBcOrder", () => {
  it("is true only for the order's current BC order number", () => {
    expect(isCurrentBcOrder("SO-200", stateWith("SO-200"))).toBe(true);
    expect(isCurrentBcOrder("SO-200", stateWith("SO-300"))).toBe(false);
    expect(isCurrentBcOrder("SO-200", stateWith(null))).toBe(false);
    expect(isCurrentBcOrder(null, stateWith(null))).toBe(false);
  });
});
