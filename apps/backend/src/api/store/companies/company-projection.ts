import type { AuthenticatedMedusaRequest } from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { storeApprovalSettingsFields } from "./query-config";

type Row = Record<string, unknown>;

const COMPANY_BASIC_FIELDS = [
  "id",
  "name",
  "logo_url",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "currency_code",
  "vat_number",
  "business_central_customer_number",
  "created_at",
  "updated_at",
] as const;

// Only returned to a company administrator of the requested company.
const COMPANY_ADMIN_FIELDS = [
  "credit_limit",
  "blocked",
  "spending_limit_reset_frequency",
] as const;

const EMPLOYEE_BASIC_FIELDS = [
  "id",
  "company_id",
  "is_admin",
  "created_at",
  "updated_at",
] as const;

const EMPLOYEE_ADMIN_FIELDS = ["spending_limit"] as const;

const EMPLOYEE_CUSTOMER_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "phone",
] as const;

const EMPLOYEE_FIELDS = [
  ...EMPLOYEE_BASIC_FIELDS,
  ...EMPLOYEE_ADMIN_FIELDS,
  ...EMPLOYEE_CUSTOMER_FIELDS.map((field) => `customer.${field}`),
];

const COMPANY_FIELDS = [...COMPANY_BASIC_FIELDS, ...COMPANY_ADMIN_FIELDS];

/** Internal query fields; never derived from caller-supplied `fields`. */
export const storeCompanyProfileQueryFields = [
  ...COMPANY_FIELDS,
  ...EMPLOYEE_FIELDS.map((field) => `employees.${field}`),
  ...storeApprovalSettingsFields.map((field) => `approval_settings.${field}`),
];

export const storeEmployeeProfileQueryFields = [
  ...EMPLOYEE_FIELDS,
  ...COMPANY_FIELDS.map((field) => `company.${field}`),
];

function pickFields(source: Row, fields: readonly string[]): Row {
  const result: Row = {};
  for (const field of fields) {
    if (field in source) {
      result[field] = source[field];
    }
  }
  return result;
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

/**
 * Resolves whether the authenticated customer administers the company in the
 * route. Ownership is re-checked here so the projection never trusts the id.
 */
export async function resolveCompanyActor(
  req: AuthenticatedMedusaRequest
): Promise<{ isAdmin: boolean }> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: ["id", "employee.company_id", "employee.is_admin"],
    filters: { id: req.auth_context.actor_id },
  });
  const employee = customer?.employee;

  if (!employee || employee.company_id !== req.params.id) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "Forbidden");
  }

  return { isAdmin: employee.is_admin === true };
}

export function toStoreEmployee(employee: Row, isAdmin: boolean): Row {
  const result = pickFields(employee, [
    ...EMPLOYEE_BASIC_FIELDS,
    ...(isAdmin ? EMPLOYEE_ADMIN_FIELDS : []),
  ]);

  if (isRow(employee.customer)) {
    result.customer = pickFields(employee.customer, EMPLOYEE_CUSTOMER_FIELDS);
  }
  if (isRow(employee.company)) {
    result.company = toStoreCompany(employee.company, isAdmin);
  }

  return result;
}

export function toStoreCompany(company: Row, isAdmin: boolean): Row {
  const result = pickFields(company, [
    ...COMPANY_BASIC_FIELDS,
    ...(isAdmin ? COMPANY_ADMIN_FIELDS : []),
  ]);

  if (Array.isArray(company.employees)) {
    result.employees = company.employees
      .filter(isRow)
      .map((employee) => toStoreEmployee(employee, isAdmin));
  }
  if (isRow(company.approval_settings)) {
    result.approval_settings = pickFields(
      company.approval_settings,
      storeApprovalSettingsFields
    );
  }

  return result;
}
