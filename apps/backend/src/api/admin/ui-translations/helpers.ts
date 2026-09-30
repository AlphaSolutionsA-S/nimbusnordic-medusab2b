import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type {
  MutationInput,
  MutationResponse,
} from "../../../types/storefront-translation";
import { localeSchema } from "../../../utils/translations/validation";
import { mutateTranslationWorkflow } from "../../../workflows/storefront-translation/workflows/mutate-translation";
import { MissingIdSchema } from "./validators";

export function translationService(req: MedusaRequest): StorefrontTranslationModuleService {
  return req.scope.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
}

export function localeParam(req: MedusaRequest, name = "locale"): string {
  const parsed = localeSchema.safeParse(req.params[name]);
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Locale must be a valid BCP 47 language tag");
  }
  return parsed.data;
}

export function missingIdParam(req: MedusaRequest): string {
  const parsed = MissingIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Missing text report was not found");
  }
  return parsed.data;
}

export async function respondWithMutation(
  req: MedusaRequest,
  res: MedusaResponse,
  input: MutationInput,
  status = 200
): Promise<void> {
  const { result } = await mutateTranslationWorkflow(req.scope).run({ input });
  const affectsStorefront = result.translation.is_active || input.operation === "activate";
  const body: MutationResponse = {
    ...result,
    // Storefront callback is added separately; the timed refresh covers active changes meanwhile.
    refresh: affectsStorefront ? "deferred" : "not_needed",
  };
  res.status(status).json(body);
}
