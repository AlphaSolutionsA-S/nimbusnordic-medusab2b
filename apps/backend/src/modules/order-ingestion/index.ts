import { Module } from "@medusajs/framework/utils";
import OrderIngestionModuleService from "./service";

export const ORDER_INGESTION_MODULE = "orderIngestion";

export default Module(ORDER_INGESTION_MODULE, {
  service: OrderIngestionModuleService,
});
