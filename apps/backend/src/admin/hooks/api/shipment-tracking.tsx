import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";

export type AdminShipmentTracking = {
  id: string;
  shipment_number: string;
  bc_order_number: string;
  order_id: string;
  external_order_number: string;
  company_id: string;
  company_name: string | null;
  last_error: string | null;
  attempts: number;
  closed_at: string;
};
export type AdminShipmentTrackingOverviewRow = {
  id: string;
  shipment_number: string;
  bc_order_number: string;
  external_order_number: string;
  company_id: string;
  company_name: string | null;
  posting_date: string;
  state: "open" | "closed";
  close_reason:
    | "cancelled"
    | "window_ended"
    | "superseded"
    | "gave_up"
    | "company_not_enabled"
    | null;
};
type Page<TRow> = {
  shipment_trackings: TRow[];
  count: number;
  limit: number;
  offset: number;
};

export function useShipmentTracking(limit: number, offset: number) {
  return useQuery({
    queryKey: ["shipment-tracking", limit, offset],
    queryFn: () => sdk.client.fetch<Page<AdminShipmentTracking>>("/admin/shipment-tracking", {
      method: "GET", query: { limit, offset },
    }),
  });
}

// Keyed under "shipment-tracking" so a Retry also refreshes the retried row's status here.
export function useShipmentTrackingOverview(limit: number, offset: number) {
  return useQuery({
    queryKey: ["shipment-tracking", "overview", limit, offset],
    queryFn: () => sdk.client.fetch<Page<AdminShipmentTrackingOverviewRow>>("/admin/shipment-tracking/overview", {
      method: "GET", query: { limit, offset },
    }),
  });
}

export function useRetryShipmentTracking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.client.fetch<{ shipment_tracking: { id: string } }>(
      `/admin/shipment-tracking/${encodeURIComponent(id)}/retry`, { method: "POST", body: {} }
    ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["shipment-tracking"] });
    },
  });
}
