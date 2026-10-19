import { model } from "@medusajs/framework/utils";

// A single row: the notice counter (its row lock serializes the store transaction), the two
// discovery scan cursors, the go-live time and the BC back-off. Created on the poll job's first
// run, never by a migration.
export const ShipmentNoticeState = model
  .define("shipment_notice_state", {
    id: model.id({ prefix: "shps" }).primaryKey(),
    state_key: model.text(),
    last_sequence: model.number().default(0),
    lead_cursor: model.dateTime(),
    trail_cursor: model.dateTime(),
    go_live_at: model.dateTime(),
    bc_backoff_until: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_shipment_notice_state_state_key_unique",
      on: ["state_key"],
      unique: true,
    },
  ]);
