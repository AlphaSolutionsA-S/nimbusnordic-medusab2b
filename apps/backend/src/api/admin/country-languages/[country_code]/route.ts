import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { sendWorkflowResult } from "../../../utils/workflow-error-response";
import { assignCountryLanguageWorkflow } from "../../../../workflows/storefront-translation/workflows/assign-country-language";
import { type AssignCountryLanguageBody, CountryCodeSchema } from "../validators";

export async function POST(
  req: AuthenticatedMedusaRequest<AssignCountryLanguageBody>,
  res: MedusaResponse
): Promise<void> {
  const country = CountryCodeSchema.safeParse(req.params.country_code);
  if (!country.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Country must be a lower-case two-letter ISO code");
  }
  await sendWorkflowResult(res, () =>
    assignCountryLanguageWorkflow(req.scope).run({
      input: {
        country_code: country.data,
        locale: req.validatedBody.locale,
        expected_version: req.validatedBody.expected_version,
      },
    })
  );
}
