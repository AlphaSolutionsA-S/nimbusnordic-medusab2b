import {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  resolveCompanyActor,
  storeEmployeeProfileQueryFields,
  toStoreEmployee,
} from "../../company-projection";
import { createEmployeeAccountWorkflow } from "../../../../../workflows/employee/workflows";
import {
  StoreCreateEmployeeType,
  StoreGetEmployeeParamsType,
} from "../../validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<StoreGetEmployeeParamsType>,
  res: MedusaResponse
) => {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { isAdmin } = await resolveCompanyActor(req);

  const { data: employees } = await query.graph({
    entity: "employee",
    fields: storeEmployeeProfileQueryFields,
    filters: { company_id: id },
  });

  res.json({
    employees: employees.map((employee) => toStoreEmployee(employee, isAdmin)),
  });
};

export const POST = async (
  req: MedusaRequest<StoreCreateEmployeeType>,
  res: MedusaResponse
) => {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const body = req.validatedBody;

  const { result } = await createEmployeeAccountWorkflow.run({
    input: {
      customerData: {
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
      },
      password: body.password,
      country_code: body.country_code,
      employeeData: {
        company_id: id,
        spending_limit: body.spending_limit ?? 0,
        is_admin: body.is_admin ?? false,
      },
    },
    container: req.scope,
  });

  const {
    data: [employee],
  } = await query.graph(
    {
      entity: "employee",
      fields: req.queryConfig.fields,
      filters: {
        ...req.filterableFields,
        id: result.employee.id,
      },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};
