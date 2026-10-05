import { MiddlewareRoute } from "@medusajs/medusa";
import { adminCompaniesMiddlewares } from "./companies/middlewares";
import { adminQuotesMiddlewares } from "./quotes/middlewares";
import { adminApprovalsMiddlewares } from "./approvals/middlewares";
import { adminUiTranslationsMiddlewares } from "./ui-translations/middlewares";
import { adminBcIntegrationMiddlewares } from "./orders/[id]/bc-integration/middlewares";

export const adminMiddlewares: MiddlewareRoute[] = [
  ...adminCompaniesMiddlewares,
  ...adminQuotesMiddlewares,
  ...adminApprovalsMiddlewares,
  ...adminUiTranslationsMiddlewares,
  ...adminBcIntegrationMiddlewares,
];
