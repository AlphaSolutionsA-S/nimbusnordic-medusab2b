import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import {
  ActivationSchema,
  CreateTranslationSchema,
  DismissMissingSchema,
  ImportPreviewSchema,
  ImportTranslationSchema,
  MissingListQuerySchema,
  ResolveMissingSchema,
  SaveTranslationSchema,
} from "./validators";

// Framework admin authentication applies to every /admin route; nothing here relaxes it.
const documentBodyParser = { sizeLimit: "1mb" };

export const adminUiTranslationsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/ui-translations",
    bodyParser: documentBodyParser,
    middlewares: [validateAndTransformBody(CreateTranslationSchema)],
  },
  {
    method: ["GET"],
    matcher: "/admin/ui-translations/missing-keys",
    middlewares: [validateAndTransformQuery(MissingListQuerySchema, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale",
    bodyParser: documentBodyParser,
    middlewares: [validateAndTransformBody(SaveTranslationSchema)],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/import-preview",
    bodyParser: documentBodyParser,
    middlewares: [validateAndTransformBody(ImportPreviewSchema)],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/import",
    bodyParser: documentBodyParser,
    middlewares: [validateAndTransformBody(ImportTranslationSchema)],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/activation",
    middlewares: [validateAndTransformBody(ActivationSchema)],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/missing-keys/:id/resolve",
    middlewares: [validateAndTransformBody(ResolveMissingSchema)],
  },
  {
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/missing-keys/:id/dismiss",
    middlewares: [validateAndTransformBody(DismissMissingSchema)],
  },
];
