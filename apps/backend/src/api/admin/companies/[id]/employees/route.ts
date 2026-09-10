import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createEmployeeAccountWorkflow,
  createEmployeesWorkflow,
} from "../../../../../workflows/employee/workflows";
import {
  AdminCreateEmployeeType,
  AdminGetEmployeeParamsType,
} from "../../validators";

export const GET = async (
  req: MedusaRequest<AdminGetEmployeeParamsType>,
  res: MedusaResponse
) => {
  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [{ employees }],
    metadata,
  } = await query.graph(
    {
      entity: "company",
      fields: [...req.queryConfig.fields, "employees.*"],
      filters: {
        id,
        ...req.filterableFields,
      },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({
    employees,
    count: metadata?.count,
    offset: metadata?.skip,
    limit: metadata?.take,
  });
};

export const POST = async (
  req: MedusaRequest<AdminCreateEmployeeType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { id } = req.params;
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
      filters: { id: createdEmployeeId },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};
