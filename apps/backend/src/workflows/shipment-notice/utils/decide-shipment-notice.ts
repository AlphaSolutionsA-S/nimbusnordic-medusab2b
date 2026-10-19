import { createHash } from "node:crypto";

import type {
  BCShipment,
  BCShipmentLine,
  BCShipmentParty,
  BCShipmentShipTo,
} from "../../../modules/business-central/types";
import type { BcOrderLineMapEntry } from "../../../modules/order-ingestion/bc-integration-state";
import type {
  ShipmentNoticeLine,
  ShipmentNoticePayload,
  ShipmentNoticeStatus,
} from "../../../modules/order-ingestion/shipment-notice-contract";
import type { ShipmentTrackingRow } from "../../../modules/order-ingestion/shipment-notice-storage";

/** The latest stored revision of a shipment, which the decision is made against. */
export interface LatestShipmentRevision {
  revision: number;
  content_hash: string;
  /** `bc_line_number` of every line the revision listed. */
  listed_bc_line_numbers: readonly number[];
}

export interface ShipmentNoticeDecisionInput {
  shipment: BCShipment;
  order: Pick<
    ShipmentTrackingRow,
    "order_id" | "external_order_number" | "bc_order_number" | "posting_date"
  > & { bc_lines: readonly BcOrderLineMapEntry[] | null };
  latest: LatestShipmentRevision | null;
}

export type ShipmentNoticeDecision =
  | {
      kind: "record";
      status: ShipmentNoticeStatus;
      content_hash: string;
      payload: ShipmentNoticePayload;
    }
  | { kind: "nothing" }
  | { kind: "unpairable"; sequence: number };

type NettedLine = { line: BCShipmentLine; net: number; corrected: boolean };

/**
 * BC exposes no correction flag, so an undo correction (negative quantity) is paired with the
 * nearest preceding positive item line not yet corrected, by BC line number (held for every
 * correction pair in TestDK, NIMBUS-130). That line must have the same item, unit and the opposite quantity, else the shipment is
 * unpairable. Sorting first makes the result independent of BC's response order.
 */
function netItemLines(lines: readonly BCShipmentLine[]): NettedLine[] | { unpairable: number } {
  const netted: NettedLine[] = [];
  const itemLines = lines
    .filter((line) => line.lineType === "item")
    .sort((a, b) => a.sequence - b.sequence);

  for (const line of itemLines) {
    if (line.quantity >= 0) {
      netted.push({ line, net: line.quantity, corrected: false });
      continue;
    }

    let original: NettedLine | undefined;
    for (let i = netted.length - 1; i >= 0 && !original; i--) {
      if (netted[i].line.quantity > 0 && !netted[i].corrected) {
        original = netted[i];
      }
    }

    if (
      !original ||
      original.line.itemNumber !== line.itemNumber ||
      original.line.unitOfMeasureCode !== line.unitOfMeasureCode ||
      original.line.quantity !== -line.quantity
    ) {
      return { unpairable: line.sequence };
    }

    original.net = 0;
    original.corrected = true;
  }

  return netted;
}

// Canonical (BC line number, item, unit, net quantity) of the lines shipped now.
function contentHash(shipped: readonly NettedLine[]): string {
  const canonical = shipped.map(({ line, net }) => [
    line.sequence,
    line.itemNumber,
    line.unitOfMeasureCode,
    net,
  ]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function toParty(party: BCShipmentParty): ShipmentNoticePayload["sell_to"] {
  return {
    customer_number: party.customerNumber,
    name: party.name,
    address_line_1: party.addressLine1,
    address_line_2: party.addressLine2,
    city: party.city,
    state: party.state,
    post_code: party.postCode,
    country: party.country,
  };
}

function toShipTo(shipTo: BCShipmentShipTo): ShipmentNoticePayload["ship_to"] {
  return {
    name: shipTo.name,
    contact: shipTo.contact,
    address_line_1: shipTo.addressLine1,
    address_line_2: shipTo.addressLine2,
    city: shipTo.city,
    state: shipTo.state,
    post_code: shipTo.postCode,
    country: shipTo.country,
  };
}

/**
 * Turns one BC shipment, the order's BC line map and the latest stored revision into a
 * notice to record, nothing, or "unpairable" (the BC line that could not be netted or listed).
 * Revision 1 lists the lines shipped (net > 0); a later revision lists every line listed before,
 * 0 where undone, and is `cancelled` when all are 0.
 */
export function decideShipmentNotice(input: ShipmentNoticeDecisionInput): ShipmentNoticeDecision {
  const { shipment, order, latest } = input;
  const netted = netItemLines(shipment.lines);

  if (!Array.isArray(netted)) {
    return { kind: "unpairable", sequence: netted.unpairable };
  }

  const shipped = netted.filter((entry) => entry.net > 0);
  const content_hash = contentHash(shipped);

  if (latest === null ? shipped.length === 0 : latest.content_hash === content_hash) {
    return { kind: "nothing" };
  }

  const listedNumbers = new Set([
    ...(latest?.listed_bc_line_numbers ?? []),
    ...shipped.map((entry) => entry.line.sequence),
  ]);
  const listed: ShipmentNoticeLine[] = [];

  for (const sequence of [...listedNumbers].sort((a, b) => a - b)) {
    const entry = netted.find((candidate) => candidate.line.sequence === sequence);
    if (!entry || entry.line.itemNumber === null) {
      return { kind: "unpairable", sequence };
    }

    const mapped = order.bc_lines?.find((mapEntry) => mapEntry.bc_sequence === sequence);
    listed.push({
      line_number: mapped?.line_number ?? null,
      ean_no: mapped?.ean_no ?? null,
      bc_line_number: sequence,
      item_number: entry.line.itemNumber,
      description: entry.line.description,
      description_2: entry.line.description2,
      unit_of_measure_code: entry.line.unitOfMeasureCode,
      quantity: entry.net,
      shipment_date: entry.line.shipmentDate ?? order.posting_date,
    });
  }

  const status: ShipmentNoticeStatus =
    latest === null ? "shipped" : shipped.length === 0 ? "cancelled" : "revised";

  return {
    kind: "record",
    status,
    content_hash,
    payload: {
      order_id: order.order_id,
      external_order_number: order.external_order_number,
      bc_order_number: order.bc_order_number,
      shipment_number: shipment.number,
      shipment_date: order.posting_date,
      shipment_method_code: shipment.shipmentMethodCode,
      your_reference: shipment.yourReference,
      sell_to: toParty(shipment.sellTo),
      bill_to: toParty(shipment.billTo),
      ship_to: toShipTo(shipment.shipTo),
      lines: listed,
    },
  };
}
