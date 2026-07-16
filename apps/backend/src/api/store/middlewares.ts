import { MiddlewareRoute } from "@medusajs/medusa";
import { storeApprovalsMiddlewares } from "./approvals/middlewares";
import { storeBCOrdersMiddlewares } from "./bc-orders/middlewares";
import { storeBusinessCentralMiddlewares } from "./business-central/middlewares";
import { storeCartsMiddlewares } from "./carts/middlewares";
import { storeCompaniesMiddlewares } from "./companies/middlewares";
import { storeFreeShippingMiddlewares } from "./free-shipping/middlewares";
import { storeQuotesMiddlewares } from "./quotes/middlewares";

export const storeMiddlewares: MiddlewareRoute[] = [
  ...storeBusinessCentralMiddlewares,
  ...storeBCOrdersMiddlewares,
  ...storeCartsMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeQuotesMiddlewares,
  ...storeFreeShippingMiddlewares,
  ...storeApprovalsMiddlewares,
];
