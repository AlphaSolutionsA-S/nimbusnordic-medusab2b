import { createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { z } from "@medusajs/framework/zod";

/* Company Validators */
export type AdminGetCompanyParamsType = z.infer<typeof AdminGetCompanyParams>;
export const AdminGetCompanyParams = createSelectParams();

export type AdminCreateCompanyType = z.infer<typeof AdminCreateCompany>;
export const AdminCreateCompany = z
  .object({
    name: z.string(),
    email: z.string(),
    currency_code: z.string(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    logo_url: z.string().optional().nullable(),
    business_central_customer_number: z
      .string()
      .regex(/^\d+$/, "Business Central customer number must be numeric only")
      .optional()
      .nullable(),
  })
  .strict();

export type AdminUpdateCompanyType = z.infer<typeof AdminUpdateCompany>;
export const AdminUpdateCompany = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    currency_code: z.string().optional(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    logo_url: z.string().optional().nullable(),
    business_central_customer_number: z
      .string()
      .regex(/^\d+$/, "Business Central customer number must be numeric only")
      .optional()
      .nullable(),
  })
  .strict();

export type AdminGetCustomerGroupParamsType = z.infer<
  typeof AdminGetCustomerGroupParams
>;
export const AdminGetCustomerGroupParams = createSelectParams();

export type AdminAddCompanyToCustomerGroupType = z.infer<
  typeof AdminAddCompanyToCustomerGroup
>;
export const AdminAddCompanyToCustomerGroup = z.object({
  group_id: z.string(),
});

export type AdminRemoveCompanyFromCustomerGroupType = z.infer<
  typeof AdminRemoveCompanyFromCustomerGroup
>;
export const AdminRemoveCompanyFromCustomerGroup = z.object({
  group_id: z.string(),
});

/* Employee Validators */

export type AdminGetEmployeeParamsType = z.infer<typeof AdminGetEmployeeParams>;
export const AdminGetEmployeeParams = createSelectParams();

export type AdminCreateEmployeeType = z.infer<typeof AdminCreateEmployee>;
export const AdminCreateEmployee = z
  .object({
    spending_limit: z.number().optional(),
    raw_spending_limit: z
      .object({
        value: z.number().optional(),
        precision: z.number().optional(),
      })
      .optional(),
    is_admin: z.boolean().optional(),
    customer_id: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(8).optional(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.customer_id) || Boolean(data.email && data.password),
    {
      message:
        "Provide either an existing customer_id or an email and password to create a new employee account.",
    }
  );

export type AdminUpdateEmployeeType = z.infer<typeof AdminUpdateEmployee>;
export const AdminUpdateEmployee = z
  .object({
    id: z.string(),
    spending_limit: z.number().optional(),
    raw_spending_limit: z
      .object({
        value: z.number().optional(),
        precision: z.number().optional(),
      })
      .optional(),
    is_admin: z.boolean().optional(),
  })
  .strict();

export type AdminDeleteEmployeeType = z.infer<typeof AdminDeleteEmployee>;
export const AdminDeleteEmployee = z
  .object({
    delete_customer_account: z.boolean().default(false),
  })
  .strict();

/* Approval Settings Validators */
export type AdminGetApprovalSettingsParamsType = z.infer<
  typeof AdminGetApprovalSettingsParams
>;
export const AdminGetApprovalSettingsParams = createSelectParams();

export type AdminCreateApprovalSettingsType = z.infer<
  typeof AdminCreateApprovalSettings
>;
export const AdminCreateApprovalSettings = z
  .object({
    company_id: z.string(),
    requires_admin_approval: z.boolean(),
    requires_sales_manager_approval: z.boolean(),
  })
  .strict();

export type AdminUpdateApprovalSettingsType = z.infer<
  typeof AdminUpdateApprovalSettings
>;
export const AdminUpdateApprovalSettings = z
  .object({
    id: z.string(),
    requires_admin_approval: z.boolean(),
    requires_sales_manager_approval: z.boolean(),
  })
  .strict();

export type AdminDeleteApprovalSettingsType = z.infer<
  typeof AdminDeleteApprovalSettings
>;
export const AdminDeleteApprovalSettings = z.object({
  ids: z.array(z.string()),
});
