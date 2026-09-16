import { MedusaService } from "@medusajs/framework/utils";
import { OrderExternalReference } from "./models";

class OrderIngestionModuleService extends MedusaService({
  OrderExternalReference,
}) {}

export default OrderIngestionModuleService;
