import { model } from "@medusajs/framework/utils";

// No relation to storefront_translation: whole-locale outage reports can precede a first import.
export const TranslationMissingKey = model
  .define("translation_missing_key", {
    id: model.id({ prefix: "trmk" }).primaryKey(),
    locale: model.text(),
    key: model.text(),
    count: model.number().default(1),
    first_seen_at: model.dateTime(),
    last_seen_at: model.dateTime(),
    last_page_path: model.text(),
    dismissed: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_translation_missing_key_locale_key_unique",
      on: ["locale", "key"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_translation_missing_key_locale_dismissed_seen",
      on: ["locale", "dismissed", "last_seen_at"],
      where: "deleted_at IS NULL",
    },
  ]);
