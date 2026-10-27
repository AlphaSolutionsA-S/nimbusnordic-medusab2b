import type {
  AdminBusinessCentralCustomerLookupResponse,
  AdminBusinessCentralCustomerResponse,
} from "../../../../../types";
import type {
  BusinessCentralAccount,
  BusinessCentralCustomerLookup,
} from "../../../../../workflows/company/workflows";

export function toAdminBusinessCentralCustomer(
  account: BusinessCentralAccount
): AdminBusinessCentralCustomerResponse {
  const { notFound } = account;

  return {
    routed_environment: account.environment,
    customer_number: account.customerNumber,
    not_found: notFound && {
      at: notFound.at,
      environment: notFound.environment,
      customer_number: notFound.customerNumber,
    },
  };
}

export function toAdminBusinessCentralCustomerLookup(
  lookup: BusinessCentralCustomerLookup
): AdminBusinessCentralCustomerLookupResponse {
  return {
    customer_number: lookup.customerNumber,
    results: lookup.results.map(({ environment, status, customer }) => ({
      environment,
      status,
      customer: customer && {
        name: customer.name,
        country: customer.country,
        routes_to: customer.routesTo,
        routes_elsewhere: customer.routesElsewhere,
      },
    })),
  };
}
