import { defineLink } from "@medusajs/framework/utils";
import OrderModule from "@medusajs/medusa/order";
import CompanyModule from "../modules/company";

export default defineLink(
  { linkable: OrderModule.linkable.order, isList: true },
  CompanyModule.linkable.company
);
