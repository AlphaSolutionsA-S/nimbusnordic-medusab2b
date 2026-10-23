import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { AdminShipmentTrackingOverviewQueryType } from "../middlewares";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { limit, offset } = req.validatedQuery as AdminShipmentTrackingOverviewQueryType;
  const query: Omit<RemoteQueryFunction, symbol> = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  // Sorts on posting_date as text: assumes BC's postingDate is YYYY-MM-DD (Edm.Date), so text order is date order.
  const { data: rows, metadata } = await query.graph({
    entity: "shipment_tracking",
    fields: ["id", "shipment_number", "bc_order_number", "external_order_number", "company_id", "posting_date", "state", "close_reason"],
    pagination: { take: limit, skip: offset, order: { posting_date: "DESC", id: "DESC" } },
  });
  const { data: companies } = await query.graph({
    entity: "companies", fields: ["id", "name"],
    filters: { id: [...new Set(rows.map((row) => row.company_id))] },
  });
  const names = new Map(companies.map((company) => [company.id, company.name]));
  res.json({ shipment_trackings: rows.map((row) => ({ ...row, company_name: names.get(row.company_id) ?? null })), count: metadata?.count ?? 0, limit, offset });
}
