import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { AdminShipmentTrackingQueryType } from "./middlewares";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset } = req.validatedQuery as AdminShipmentTrackingQueryType;
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: rows, metadata } = await query.graph({
    entity: "shipment_tracking",
    fields: ["id", "shipment_number", "bc_order_number", "order_id", "external_order_number", "company_id", "last_error", "attempts", "closed_at"],
    filters: { state: "closed", close_reason: "gave_up" },
    pagination: { take: limit, skip: offset, order: { closed_at: "DESC", id: "DESC" } },
  });
  const { data: companies } = await query.graph({
    entity: "companies", fields: ["id", "name"],
    filters: { id: [...new Set(rows.map((row) => row.company_id))] },
  });
  const names = new Map(companies.map((company) => [company.id, company.name]));
  res.json({ shipment_trackings: rows.map((row) => ({ ...row, company_name: names.get(row.company_id) ?? null })), count: metadata?.count ?? 0, limit, offset });
}
