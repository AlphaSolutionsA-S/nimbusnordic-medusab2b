import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  deleteCompaniesWorkflow,
  updateCompaniesWorkflow,
} from "../../../../workflows/company/workflows/";
import { syncCompanyFromBusinessCentralWorkflow } from "../../../../workflows/company/workflows/sync-company-from-business-central";
import {
  StoreGetCompanyParamsType,
  StoreUpdateCompanyType,
} from "../validators";

const BUSINESS_CENTRAL_FRESHNESS_WINDOW_MS = 10 * 60 * 1000;

function isStale(syncedAt: Date | string | null | undefined): boolean {
  if (!syncedAt) {
    return true;
  }

  const syncedMs = new Date(syncedAt).getTime();

  return (
    Number.isNaN(syncedMs) ||
    Date.now() - syncedMs > BUSINESS_CENTRAL_FRESHNESS_WINDOW_MS
  );
}

export const GET = async (
  req: AuthenticatedMedusaRequest<StoreGetCompanyParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const { id } = req.params;
  const { customer_id } = req.auth_context.app_metadata as {
    customer_id: string;
  };

  const {
    data: [existing],
  } = await query.graph(
    {
      entity: "companies",
      fields: ["id", "business_central_synced_at"],
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  if (customer_id && isStale(existing?.business_central_synced_at)) {
    try {
      await syncCompanyFromBusinessCentralWorkflow(req.scope).run({
        input: { customerId: customer_id },
      });
    } catch (error) {
      logger.error(`Business Central freshness sync failed for company ${id}`);
    }
  }

  const { data } = await query.graph(
    {
      entity: "companies",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ company: data[0] });
};

export const POST = async (
  req: MedusaRequest<StoreUpdateCompanyType>,
  res: MedusaResponse
) => {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  await updateCompaniesWorkflow.run({
    input: {
      id,
      ...req.body,
    },
    container: req.scope,
  });

  const {
    data: [company],
  } = await query.graph(
    {
      entity: "companies",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ company });
};

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  await deleteCompaniesWorkflow.run({
    input: { id },
    container: req.scope,
    throwOnError: true,
  });

  res.status(204).send();
};
