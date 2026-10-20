import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { requireAdminSession, smallJsonBodyParser } from "../../middlewares/require-admin-session";
import { requireJsonBody } from "../../middlewares/require-json-body";
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
// Activation is tightened further below.
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
    // Deactivation can unpublish a language for whole countries, so it takes the same
    // session-only, JSON-only, 1 KiB contract as country-language management.
    method: ["POST"],
    matcher: "/admin/ui-translations/:locale/activation",
    bodyParser: smallJsonBodyParser,
    middlewares: [
      requireAdminSession,
      requireJsonBody,
      validateAndTransformBody(ActivationSchema),
    ],
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
