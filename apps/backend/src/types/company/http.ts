import { FindParams, PaginatedResponse } from "@medusajs/framework/types";
import type { BusinessCentralEnvironment } from "../../modules/business-central/types";
import { QueryCompany, QueryEmployee } from "./query";
import { ModuleCompanyFilters, ModuleEmployeeFilters } from "./service";
import {
  ModuleCompanyBlockedState,
  ModuleCompanySpendingLimitResetFrequency,
} from "./module";

/* Filters */

export interface CompanyFilterParams extends FindParams, ModuleCompanyFilters {}

export interface EmployeeFilterParams
  extends FindParams,
    ModuleEmployeeFilters {}

/* Admin */

/* Company */
export type AdminCompanyResponse = {
  company: QueryCompany;
};

export type AdminCompaniesResponse = PaginatedResponse<{
  companies: QueryCompany[];
}>;

export type AdminCreateCompany = {
  name: string;
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  logo_url: string | null;
  currency_code: string | null;
  business_central_customer_number?: string | null;
  blocked?: ModuleCompanyBlockedState;
  credit_limit?: number | null;
  vat_number?: string | null;
};

export type AdminUpdateCompany = Partial<AdminCreateCompany> & {
  order_api_enabled?: boolean;
};

export type AdminSyncCompanyBusinessCentralResponse = {
  status: "updated" | "skipped" | "failed";
};

export type AdminBusinessCentralCustomerResponse = {
  routed_environment: BusinessCentralEnvironment;
  customer_number: string | null;
  not_found: {
    // ISO 8601
    at: string;
    environment: BusinessCentralEnvironment;
    customer_number: string;
  } | null;
};

export type AdminBusinessCentralCustomerLookupResult = {
  environment: BusinessCentralEnvironment;
  status: "found" | "not_found" | "could_not_check";
  customer: {
    name: string;
    country: string;
    routes_to: BusinessCentralEnvironment;
    routes_elsewhere: boolean;
  } | null;
};

export type AdminBusinessCentralCustomerLookupResponse = {
  customer_number: string;
  results: AdminBusinessCentralCustomerLookupResult[];
};

export type AdminUseBusinessCentralCustomer = {
  environment: BusinessCentralEnvironment;
};

export type AdminUseBusinessCentralCustomerResponse =
  AdminSyncCompanyBusinessCentralResponse & {
    country: string;
  };

/* Employee */

export type AdminEmployeeResponse = {
  employee: QueryEmployee;
};

export type AdminEmployeesResponse = PaginatedResponse<{
  employees: QueryEmployee[];
}>;

export type AdminCreateEmployee = {
  spending_limit: number;
  is_admin: boolean;
  company_id?: string;
  customer_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

export type AdminUpdateEmployee = Partial<AdminCreateEmployee>;

/* Store */

/* Company */

export type StoreCompanyResponse = {
  company: QueryCompany;
};

export type StoreCompaniesResponse = PaginatedResponse<{
  companies: QueryCompany[];
}>;

export type StoreCompanyPreviewResponse = {
  company: QueryCompany;
};

export type StoreCreateCompany = {
  name: string;
  phone?: string | null;
  email: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  logo_url?: string | null;
  currency_code: string;
  business_central_customer_number?: string | null;
};

export type StoreUpdateCompany = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  logo_url: string | null;
  currency_code: string;
  spending_limit_reset_frequency?: ModuleCompanySpendingLimitResetFrequency;
  business_central_customer_number?: string | null;
};

/* Employee */

export type StoreEmployeeResponse = {
  employee: QueryEmployee;
};

export type StoreEmployeesResponse = {
  employees: QueryEmployee[];
};

export type StoreCreateEmployee = {
  spending_limit: number;
  is_admin: boolean;
  company_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  country_code?: string;
};

export type StoreUpdateEmployee = {
  id: string;
  spending_limit: number;
  is_admin: boolean;
  company_id: string;
};
