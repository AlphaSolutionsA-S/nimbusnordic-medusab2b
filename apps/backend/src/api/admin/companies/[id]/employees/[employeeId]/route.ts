import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  deleteEmployeesWorkflow,
  updateEmployeesWorkflow,
} from "../../../../../../workflows/employee/workflows";
import {
  AdminGetEmployeeParamsType,
  AdminDeleteEmployeeType,
  AdminUpdateEmployeeType,
} from "../../../validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<AdminGetEmployeeParamsType>,
  res: MedusaResponse
) => {
  const { id, employeeId } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [employee],
  } = await query.graph(
    {
      entity: "employee",
      fields: req.queryConfig?.fields,
      filters: { ...req.filterableFields, id: employeeId },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateEmployeeType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { id, employeeId } = req.params;
  const { spending_limit, is_admin } = req.body;

  await updateEmployeesWorkflow.run({
    input: {
      id: employeeId,
      company_id: id,
      spending_limit,
      is_admin,
    },
    container: req.scope,
  });

  const {
    data: [employee],
  } = await query.graph(
    {
      entity: "employee",
      fields: req.queryConfig?.fields,
      filters: { ...req.filterableFields, id: employeeId },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest<AdminDeleteEmployeeType>,
  res: MedusaResponse
) => {
  const { id, employeeId } = req.params;
  const { delete_customer_account } = req.validatedBody;

  await deleteEmployeesWorkflow.run({
    input: {
      employee_id: employeeId,
      company_id: id,
      delete_customer_account,
    },
    container: req.scope,
  });

  res.status(200).json({
    id: employeeId,
    object: "employee",
    deleted: true,
  });
};
