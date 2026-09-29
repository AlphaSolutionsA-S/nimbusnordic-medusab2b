import { HttpTypes } from "@medusajs/types"
import { QueryApprovalSettings } from "../approval/query"
import { ModuleCompany, ModuleEmployee } from "./module"

// `spending_limit` is omitted by the store API for non-admin employees.
export type QueryEmployee = Omit<ModuleEmployee, "spending_limit"> & {
  spending_limit?: number
  customer: HttpTypes.StoreCustomer
  company?: QueryCompany
}

export type QueryCompany = ModuleCompany & {
  employees?: QueryEmployee[]
  approval_settings?: QueryApprovalSettings
}
