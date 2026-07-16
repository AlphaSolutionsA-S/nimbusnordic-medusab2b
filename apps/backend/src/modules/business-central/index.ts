import { Module } from "@medusajs/framework/utils";
import BusinessCentralModuleService from "./service";

export const BUSINESS_CENTRAL_MODULE = "businessCentral";

export default Module(BUSINESS_CENTRAL_MODULE, {
  service: BusinessCentralModuleService,
});
