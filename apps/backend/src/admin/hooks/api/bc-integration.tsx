import { useMutation, useQuery } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import type { AdminBcIntegration } from "../../../workflows/business-central-order/utils/admin-bc-integration";

type BcIntegrationResponse = { bc_integration: AdminBcIntegration };
type SubmitOrderToBcInput = { force_resend: boolean };
export const useBcIntegrationStatus = (orderId: string) =>
  useQuery({
    queryKey: ["bc-integration", orderId],
    queryFn: () =>
      sdk.client.fetch<BcIntegrationResponse>(
        `/admin/orders/${encodeURIComponent(orderId)}/bc-integration`,
        { method: "GET" }
      ),
    retry: false,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
export const useSubmitOrderToBc = (orderId: string) =>
  useMutation({
    mutationFn: (input: SubmitOrderToBcInput) =>
      sdk.client.fetch<{ message: string }>(
        `/admin/orders/${encodeURIComponent(orderId)}/bc-integration/submit`,
        { method: "POST", body: input }
      ),
  });
