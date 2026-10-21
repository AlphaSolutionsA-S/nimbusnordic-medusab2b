import { MiddlewareRoute } from "@medusajs/medusa";
import { storeApprovalsMiddlewares } from "./approvals/middlewares";
import { storeBCOrdersMiddlewares } from "./bc-orders/middlewares";
import { storeBCReturnsMiddlewares } from "./bc-returns/middlewares";
import { storeBusinessCentralMiddlewares } from "./business-central/middlewares";
import { storeCartsMiddlewares } from "./carts/middlewares";
import { storeCompaniesMiddlewares } from "./companies/middlewares";
import { storeCustomersMiddlewares } from "./customers/middlewares";
import { storeFreeShippingMiddlewares } from "./free-shipping/middlewares";
import { storeOrdersMiddlewares } from "./orders/middlewares";
import { storePaymentCollectionsMiddlewares } from "./payment-collections/middlewares";
import { storeQuotesMiddlewares } from "./quotes/middlewares";
import { storeReturnsMiddlewares } from "./returns/middlewares";
import { storeShippingOptionsMiddlewares } from "./shipping-options/middlewares";

export const storeMiddlewares: MiddlewareRoute[] = [
  ...storeBusinessCentralMiddlewares,
  ...storeBCOrdersMiddlewares,
  ...storeBCReturnsMiddlewares,
  ...storeCartsMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeCustomersMiddlewares,
  ...storeQuotesMiddlewares,
  ...storeFreeShippingMiddlewares,
  ...storeApprovalsMiddlewares,
  ...storePaymentCollectionsMiddlewares,
  ...storeShippingOptionsMiddlewares,
  ...storeOrdersMiddlewares,
  ...storeReturnsMiddlewares,
];
