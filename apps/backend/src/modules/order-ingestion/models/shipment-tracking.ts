import { model } from "@medusajs/framework/utils";

export const SHIPMENT_TRACKING_STATES = ["open", "closed"] as const;

export const SHIPMENT_TRACKING_CLOSE_REASONS = [
  "cancelled",
  "window_ended",
  "superseded",
  "gave_up",
] as const;

// The check schedule of one BC shipment of an API order.
export const ShipmentTracking = model
  .define("shipment_tracking", {
    id: model.id({ prefix: "shtr" }).primaryKey(),
    bc_shipment_id: model.text(),
    shipment_number: model.text(),
    bc_order_number: model.text(),
    posting_date: model.text(),
    company_id: model.text(),
    order_id: model.text(),
    external_order_number: model.text(),
    latest_revision: model.number().default(0),
    state: model.enum([...SHIPMENT_TRACKING_STATES]).default("open"),
    close_reason: model.enum([...SHIPMENT_TRACKING_CLOSE_REASONS]).nullable(),
    next_check_at: model.dateTime(),
    recheck_until: model.dateTime(),
    final_check_done: model.boolean().default(false),
    closed_at: model.dateTime().nullable(),
    reopened_at: model.dateTime().nullable(),
    reopened_by: model.text().nullable(),
    attempts: model.number().default(0),
    last_error: model.text().nullable(),
    last_checked_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_shipment_tracking_bc_shipment_id_unique",
      on: ["bc_shipment_id"],
      unique: true,
    },
    {
      name: "IDX_shipment_tracking_state_next_check_at",
      on: ["state", "next_check_at"],
    },
  ]);
