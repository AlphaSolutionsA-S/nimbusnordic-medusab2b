import { model } from "@medusajs/framework/utils";

export const StorefrontTranslation = model
  .define("storefront_translation", {
    id: model.id({ prefix: "sftr" }).primaryKey(),
    locale: model.text(),
    messages: model.json(),
    version: model.number().default(1),
    is_active: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_storefront_translation_locale_unique",
      on: ["locale"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
