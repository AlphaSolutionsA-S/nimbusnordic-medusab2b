export const cartFields = [
  "id",
  "*items",
  "*customer",
  "company.id",
  "company.name",
  "*region",
  "currency_code",
];

export const retrieveCartTransformQueryConfig = {
  defaults: cartFields,
  // Keep the defaults queryable now that a non-empty allow list activates
  // strict field filtering on this route.
  allowed: cartFields.map((field) => field.replace(/^\*/, "")),
  isList: false,
};
