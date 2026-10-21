import { validateAndTransformBody } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { requireAdminSession, smallJsonBodyParser } from "../../middlewares/require-admin-session";
import { requireJsonBody } from "../../middlewares/require-json-body";
import { AssignCountryLanguageSchema } from "./validators";

export const adminCountryLanguagesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/country-languages",
    middlewares: [requireAdminSession],
  },
  {
    method: ["POST"],
    matcher: "/admin/country-languages/:country_code",
    bodyParser: smallJsonBodyParser,
    middlewares: [
      requireAdminSession,
      requireJsonBody,
      validateAndTransformBody(AssignCountryLanguageSchema),
    ],
  },
];
