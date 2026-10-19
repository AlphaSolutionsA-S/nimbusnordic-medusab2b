import { model } from "@medusajs/framework/utils";
import { SHIPMENT_NOTICE_STATUSES } from "../shipment-notice-contract";

// One revision of one posted BC shipment of an API order. Written only by the store transaction
// in the module service, never updated or deleted (NIMBUS-130).
export const ShipmentNotice = model
  .define("shipment_notice", {
    id: model.id({ prefix: "shpn" }).primaryKey(),
    sequence: model.number(),
    previous_sequence: model.number().nullable(),
    bc_shipment_id: model.text(),
    revision: model.number(),
    status: model.enum([...SHIPMENT_NOTICE_STATUSES]),
    content_hash: model.text(),
    company_id: model.text(),
    order_id: model.text(),
    external_order_number: model.text(),
    bc_order_number: model.text(),
    shipment_number: model.text(),
    shipment_date: model.text(),
    bc_last_modified_at: model.dateTime(),
    payload: model.json(),
  })
  .indexes([
    {
      name: "IDX_shipment_notice_sequence_unique",
      on: ["sequence"],
      unique: true,
    },
    {
      name: "IDX_shipment_notice_bc_shipment_revision_unique",
      on: ["bc_shipment_id", "revision"],
      unique: true,
    },
    {
      name: "IDX_shipment_notice_company_sequence",
      on: ["company_id", "sequence"],
    },
    {
      name: "IDX_shipment_notice_order_id",
      on: ["order_id"],
    },
  ]);
