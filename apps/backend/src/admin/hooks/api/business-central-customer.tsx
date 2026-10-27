import type { FetchError } from "@medusajs/js-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminBusinessCentralCustomerLookupResponse,
  AdminBusinessCentralCustomerResponse,
  AdminUseBusinessCentralCustomer,
  AdminUseBusinessCentralCustomerResponse,
} from "../../../types";
import { sdk } from "../../lib/client";
import { companyQueryKey } from "./companies";

// Under the company detail key, so every company invalidation (edit, sync, "Use this customer")
// also reloads the section: each of them can change the routed environment or the not-found record.
const businessCentralCustomerQueryKey = (companyId: string) =>
  [...companyQueryKey.detail(companyId), "business-central-customer"] as const;

const businessCentralCustomerUrl = (companyId: string) =>
  `/admin/companies/${encodeURIComponent(companyId)}/business-central-customer`;

export const useBusinessCentralCustomer = (companyId: string) =>
  useQuery<AdminBusinessCentralCustomerResponse, FetchError>({
    queryKey: businessCentralCustomerQueryKey(companyId),
    queryFn: () =>
      sdk.client.fetch<AdminBusinessCentralCustomerResponse>(
        businessCentralCustomerUrl(companyId),
        { method: "GET" }
      ),
  });

// Reads Business Central in both environments, so it runs only when the admin asks (`refetch`);
// the key carries the customer number so a changed number never shows the old number's results.
export const useBusinessCentralCustomerLookup = (
  companyId: string,
  customerNumber: string | null | undefined
) =>
  useQuery<AdminBusinessCentralCustomerLookupResponse, FetchError>({
    queryKey: [...businessCentralCustomerQueryKey(companyId), "lookup", customerNumber],
    queryFn: () =>
      sdk.client.fetch<AdminBusinessCentralCustomerLookupResponse>(
        `${businessCentralCustomerUrl(companyId)}/lookup`,
        { method: "GET" }
      ),
    enabled: false,
    retry: false,
  });

export const useUseBusinessCentralCustomer = (companyId: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUseBusinessCentralCustomerResponse,
    FetchError,
    AdminUseBusinessCentralCustomer
  >({
    mutationFn: ({ environment }) =>
      sdk.client.fetch<AdminUseBusinessCentralCustomerResponse>(
        `${businessCentralCustomerUrl(companyId)}/use`,
        { method: "POST", body: { environment } }
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: companyQueryKey.detail(companyId) });
      queryClient.invalidateQueries({ queryKey: companyQueryKey.lists() });
    },
  });
};
