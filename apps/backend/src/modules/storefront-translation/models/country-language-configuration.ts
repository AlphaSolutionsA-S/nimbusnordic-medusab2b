import { model } from "@medusajs/framework/utils";

// One row with a fixed id; the service, not generated CRUD, is the only writer.
export const CountryLanguageConfiguration = model.define("country_language_configuration", {
  id: model.text().primaryKey(),
  assignments: model.json(),
  version: model.number().default(1),
});
