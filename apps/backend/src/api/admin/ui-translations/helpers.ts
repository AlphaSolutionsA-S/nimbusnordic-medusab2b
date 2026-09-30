import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { STOREFRONT_TRANSLATION_MODULE } from "../../../modules/storefront-translation";
import type StorefrontTranslationModuleService from "../../../modules/storefront-translation/service";
import type {
  MutationInput,
  MutationResponse,
} from "../../../types/storefront-translation";
import { revalidateStorefrontTranslations } from "../../../utils/translations/revalidate-storefront";
import { localeSchema } from "../../../utils/translations/validation";
import { mutateTranslationWorkflow } from "../../../workflows/storefront-translation/workflows/mutate-translation";
import { MissingIdSchema } from "./validators";

export function translationService(req: MedusaRequest): StorefrontTranslationModuleService {
  return req.scope.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
}

export function localeParam(req: MedusaRequest, name = "locale"): string {
  const parsed = localeSchema.safeParse(req.params[name]);
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Locale must be a valid BCP 47 language tag"
    );
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
  // The mutation is committed at this point; a failed callback never rolls it back.
  const affectsStorefront = result.translation.is_active || input.operation === "activate";
  const refresh = affectsStorefront
    ? await revalidateStorefrontTranslations(
        {
          locale: result.translation.locale,
          version: result.translation.version,
          is_active: result.translation.is_active,
        },
        req.scope.resolve(ContainerRegistrationKeys.LOGGER)
      )
    : "not_needed";
  const body: MutationResponse = { ...result, refresh };
  res.status(status).json(body);
}
