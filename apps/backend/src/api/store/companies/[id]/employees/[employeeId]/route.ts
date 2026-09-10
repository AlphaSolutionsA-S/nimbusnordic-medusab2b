import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  deleteEmployeesWorkflow,
  updateEmployeesWorkflow,
} from "../../../../../../workflows/employee/workflows";
import {
  StoreGetEmployeeParamsType,
  StoreDeleteEmployeeType,
  StoreUpdateEmployeeType,
} from "../../../validators";

export const GET = async (
  req: MedusaRequest<StoreGetEmployeeParamsType>,
  res: MedusaResponse
) => {
  const { employeeId } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [employee],
  } = await query.graph(
    {
      entity: "employee",
      // TODO: fix this
      fields: req.queryConfig.fields,
      filters: {
        ...req.filterableFields,
        id: employeeId,
      },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};

export const POST = async (
  req: MedusaRequest<StoreUpdateEmployeeType>,
  res: MedusaResponse
) => {
  const { id, employeeId } = req.params;
  const { spending_limit, is_admin } = req.validatedBody;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

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
      // TODO: fix this
      fields: req.queryConfig.fields,
      filters: {
        ...req.filterableFields,
        id: employeeId,
      },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ employee });
};

export const DELETE = async (
  req: MedusaRequest<StoreDeleteEmployeeType>,
  res: MedusaResponse
) => {
  const { employeeId } = req.params;
  const { delete_customer_account } = req.validatedBody;

  await deleteEmployeesWorkflow.run({
    input: {
      employee_id: employeeId,
      company_id: req.params.id,
      delete_customer_account,
    },
    container: req.scope,
  });

  res.json({
    id: employeeId,
    object: "employee",
    deleted: true,
  });
};
