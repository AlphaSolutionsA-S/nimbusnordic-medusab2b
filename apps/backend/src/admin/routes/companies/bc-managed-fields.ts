/** Company fields overwritten from Business Central when a company customer logs in. */
export const BC_MANAGED_COMPANY_FIELDS = [
  "name",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "blocked",
  "credit_limit",
  "vat_number",
  "currency_code",
] as const;

export type BcManagedCompanyField = (typeof BC_MANAGED_COMPANY_FIELDS)[number];

export const BC_MANAGED_INDICATOR_LABEL = "Business Central-managed";

export const BC_MANAGED_WARNING_TITLE =
  "Business Central is authoritative for this company";

export const BC_MANAGED_WARNING_DESCRIPTION =
  "Fields marked Business Central-managed are overwritten with Business Central " +
  "values when a customer from this company logs in. Changes made to those fields " +
  "in Medusa are replaced. Medusa-only fields are preserved.";

export const BLOCKED_STATE_LABELS: Record<string, string> = {
  not_blocked: "Not blocked",
  Ship: "Ship",
  Invoice: "Invoice",
  All: "All",
};
