import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { ORDER_INGESTION_MODULE } from "../../../modules/order-ingestion";
import OrderIngestionModuleService from "../../../modules/order-ingestion/service";
import type { CanonicalOrder } from "../../../modules/order-ingestion/canonical-order-schema";

export type MatchCompanyAndCheckDuplicateInput = {
  customer_number: string;
  canonicalOrder: CanonicalOrder;
};

export type MatchCompanyAndCheckDuplicateOutput = {
  companyId: string;
};

/*
  A read-only step that resolves the Medusa company behind the upstream customer number and
  guards against the same external order number being submitted twice by that same company.
  It never mutates anything, so it has no compensation function.
*/
export const matchCompanyAndCheckDuplicateStep = createStep(
  "match-company-and-check-duplicate",
  async (
    input: MatchCompanyAndCheckDuplicateInput,
    { container }
  ): Promise<StepResponse<MatchCompanyAndCheckDuplicateOutput>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id"],
      filters: { business_central_customer_number: input.customer_number },
    });

    const company = companies[0];

    if (!company) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No company found for customer number '${input.customer_number}'`
      );
    }

    const orderIngestionService =
      container.resolve<OrderIngestionModuleService>(ORDER_INGESTION_MODULE);

    const duplicates = await orderIngestionService.listOrderExternalReferences({
      external_order_number: input.canonicalOrder.externalOrderNumber,
      company_id: company.id,
    });

    if (duplicates.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Order '${input.canonicalOrder.externalOrderNumber}' was already accepted for this company`
      );
    }

    return new StepResponse({ companyId: company.id });
  }
);
