import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { registerCompanyWorkflow } from "../../../workflows/company/workflows/register-company";
import { StoreCreateCompanyType } from "./validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateCompanyType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { result: { companies: createdCompanies } } = await registerCompanyWorkflow(req.scope).run({
    input: {
      company: req.validatedBody,
      customer_id: req.auth_context.actor_id,
    },
  });

  const { data: companies } = await query.graph(
    {
      entity: "companies",
      fields: req.queryConfig.fields,
      filters: { id: createdCompanies.map((company) => company.id) },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ companies });
};
