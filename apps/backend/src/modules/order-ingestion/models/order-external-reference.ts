import { model } from "@medusajs/framework/utils";

export const OrderExternalReference = model.define("order_external_reference", {
  id: model
    .id({
      prefix: "oref",
    })
    .primaryKey(),
  external_order_number: model.text(),
  company_id: model.text(),
  order_id: model.text(),
});
