import { Module } from "@medusajs/framework/utils";
import StorefrontTranslationModuleService from "./service";

export const STOREFRONT_TRANSLATION_MODULE = "storefrontTranslation";

export default Module(STOREFRONT_TRANSLATION_MODULE, {
  service: StorefrontTranslationModuleService,
});
