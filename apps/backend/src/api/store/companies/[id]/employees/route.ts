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
import {
  createEmployeeAccountWorkflow,
  createEmployeesWorkflow,
} from "../../../../../workflows/employee/workflows";
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

  let createdEmployeeId: string;

  if (body.customer_id) {
    const { result } = await createEmployeesWorkflow.run({
      input: {
        employeeData: {
          spending_limit: body.spending_limit ?? 0,
          is_admin: body.is_admin ?? false,
          company_id: id,
          customer_id: body.customer_id,
        },
        customerId: body.customer_id,
      },
      container: req.scope,
    });
    createdEmployeeId = result.id;
  } else {
    const { result } = await createEmployeeAccountWorkflow.run({
      input: {
        customerData: {
          email: body.email!,
          first_name: body.first_name,
          last_name: body.last_name,
          phone: body.phone,
        },
        password: body.password!,
        employeeData: {
          company_id: id,
          spending_limit: body.spending_limit ?? 0,
          is_admin: body.is_admin ?? false,
        },
      },
      container: req.scope,
    });
    createdEmployeeId = result.employee.id;
  }

  const {
    data: [employee],
  } = await query.graph(
    {
      entity: "employee",
      fields: req.queryConfig.fields,
      filters: {
        ...req.filterableFields,
        id: createdEmployeeId,
      },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};
