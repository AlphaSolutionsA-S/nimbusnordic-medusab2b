import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { COMPANY_MODULE } from "../../../modules/company";
import { ICompanyModuleService, ModuleEmployee } from "../../../types";

type DeleteEmployeeStepInput = {
  employee_id: string;
  company_id: string;
};

export const deleteEmployeesStep = createStep(
  "delete-employees",
  async (
    input: DeleteEmployeeStepInput,
    { container }
  ): Promise<StepResponse<ModuleEmployee, string>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const companyModuleService =
      container.resolve<ICompanyModuleService>(COMPANY_MODULE);

    const {
      data: [employee],
    } = await query.graph(
      {
        entity: "employee",
        fields: ["*", "customer.*", "company.*"],
        filters: {
          id: input.employee_id,
          company_id: input.company_id,
        },
      },
      { throwIfKeyNotFound: true }
    );

    await companyModuleService.softDeleteEmployees([input.employee_id]);

    return new StepResponse(employee as unknown as ModuleEmployee, employee.id);
  },
  async (id: string, { container }) => {
    const companyModuleService =
      container.resolve<ICompanyModuleService>(COMPANY_MODULE);
    await companyModuleService.restoreEmployees([id]);
  }
);
