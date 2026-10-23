type OrderApiAccessCompany = {
  order_api_enabled?: boolean | null;
};

/** The `companies` fields every order API access check selects with `query.graph`. */
export const ORDER_API_COMPANY_FIELDS = ["id", "order_api_enabled"] as const;

// Local generated types can lag the company model, so the row is a structural subset.
export type OrderApiCompanyRow = { id: string } & OrderApiAccessCompany;

/*
  The single home of "a company may use the order API" (NIMBUS-217): intake, shipment notices,
  shipment discovery, the check run and the Admin retry all ask this. Only an explicit `true`
  enables; a missing company or an unset value counts as switched off.
*/
export function isCompanyEnabledForOrderApi(
  company: OrderApiAccessCompany | null | undefined
): boolean {
  return company?.order_api_enabled === true;
}
