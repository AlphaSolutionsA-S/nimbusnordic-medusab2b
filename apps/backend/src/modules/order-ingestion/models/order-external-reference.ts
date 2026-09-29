import { model } from "@medusajs/framework/utils";

export const OrderExternalReference = model
  .define("order_external_reference", {
    id: model
      .id({
        prefix: "oref",
      })
      .primaryKey(),
    external_order_number: model.text(),
    company_id: model.text(),
    order_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_order_external_reference_company_external_order_unique",
      on: ["company_id", "external_order_number"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
