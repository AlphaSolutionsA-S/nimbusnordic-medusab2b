import { ExclamationCircle } from "@medusajs/icons";
import {
  Alert,
  Avatar,
  Badge,
  Container,
  Heading,
  Table,
  Text,
  Toaster,
} from "@medusajs/ui";
import { QueryEmployee } from "../../../../types";
import { useParams } from "react-router-dom";
import { useAdminCustomerGroups, useCompany } from "../../../hooks/api";
import { formatAmount } from "../../../utils";
import {
  BC_MANAGED_COMPANY_FIELDS,
  BC_MANAGED_WARNING_DESCRIPTION,
  BC_MANAGED_WARNING_TITLE,
  BcManagedCompanyField,
  BLOCKED_STATE_LABELS,
} from "../bc-managed-fields";
import { CompanyActionsMenu } from "../components";
import { BcManagedIndicator } from "../components/bc-managed-indicator";
import {
  EmployeeCreateDrawer,
  EmployeesActionsMenu,
} from "../components/employees";

const CompanyDetails = () => {
  const { companyId } = useParams();
  const { data, isPending } = useCompany(companyId!, {
    fields:
      "*employees,*employees.customer,*employees.company,*customer_group,*approval_settings",
  });

  const { data: customerGroups } = useAdminCustomerGroups();

  const company = data?.company;

  if (!company) {
    return <div>Company not found</div>;
  }

  const managedRows: Record<
    BcManagedCompanyField,
    { label: string; value: string | null | undefined }
  > = {
    name: { label: "Name", value: company.name },
    email: { label: "Email", value: company.email },
    phone: { label: "Phone", value: company.phone },
    address: { label: "Address", value: company.address },
    city: { label: "City", value: company.city },
    state: { label: "State", value: company.state },
    zip: { label: "Zip", value: company.zip },
    country: { label: "Country", value: company.country?.toUpperCase() },
    blocked: {
      label: "Blocked",
      value: BLOCKED_STATE_LABELS[company.blocked] ?? company.blocked,
    },
    credit_limit: {
      label: "Credit Limit",
      value:
        company.credit_limit != null
          ? formatAmount(company.credit_limit, company.currency_code || "USD")
          : null,
    },
    vat_number: { label: "VAT Number", value: company.vat_number },
    currency_code: { label: "Currency", value: company.currency_code?.toUpperCase() },
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">
        <Text size="small" weight="plus" leading="compact">
          {BC_MANAGED_WARNING_TITLE}
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {BC_MANAGED_WARNING_DESCRIPTION}
        </Text>
      </Alert>
      <Container className="flex flex-col p-0 overflow-hidden">
        {!isPending && (
          <>
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  src={company?.logo_url || undefined}
                  fallback={company?.name?.charAt(0)}
                />
                <Heading className="font-sans font-medium h1-core">
                  {company?.name}
                </Heading>
              </div>
              <CompanyActionsMenu
                company={company}
                customerGroups={customerGroups}
              />
            </div>
            <Table>
              <Table.Body>
                {BC_MANAGED_COMPANY_FIELDS.map((field) => (
                  <Table.Row key={field}>
                    <Table.Cell className="font-medium font-sans txt-compact-small max-w-fit">
                      <div className="flex items-center gap-2">
                        {managedRows[field].label}
                        <BcManagedIndicator />
                      </div>
                    </Table.Cell>
                    <Table.Cell>{managedRows[field].value || "-"}</Table.Cell>
                  </Table.Row>
                ))}
                <Table.Row>
                  <Table.Cell className="font-medium font-sans txt-compact-small">
                    BC Customer Number
                  </Table.Cell>
                  <Table.Cell>
                    {company?.business_central_customer_number || "-"}
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="font-medium font-sans txt-compact-small">
                    Customer Group
                  </Table.Cell>
                  <Table.Cell>
                    {company?.customer_group ? (
                      <Badge size="small" color="blue">
                        {company?.customer_group?.name}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="font-medium font-sans txt-compact-small">
                    Approval Settings
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      {company?.approval_settings?.requires_admin_approval && (
                        <Badge size="small" color="purple">
                          Requires admin approval
                        </Badge>
                      )}
                      {company?.approval_settings
                        ?.requires_sales_manager_approval && (
                        <Badge size="small" color="purple">
                          Requires sales manager approval
                        </Badge>
                      )}
                      {!company?.approval_settings?.requires_admin_approval &&
                        !company?.approval_settings
                          ?.requires_sales_manager_approval && (
                          <Badge size="small" color="grey">
                            No approval required
                          </Badge>
                        )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </>
        )}
      </Container>
      <Container className="flex flex-col p-0 overflow-hidden">
        {!isPending && (
          <>
            <div className="flex items-center gap-2 px-6 py-4 justify-between border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Heading className="font-sans font-medium h1-core">
                  Employees
                </Heading>
              </div>
              <EmployeeCreateDrawer company={company} />
            </div>
            {company?.employees && company?.employees.length > 0 ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell></Table.HeaderCell>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Email</Table.HeaderCell>
                    <Table.HeaderCell>Spending Limit</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {company?.employees.map((employee: QueryEmployee) => (
                    <Table.Row
                      key={employee.id}
                      onClick={() => {
                        window.location.href = `/app/customers/${
                          employee!.customer!.id
                        }`;
                      }}
                      className="cursor-pointer"
                    >
                      <Table.Cell className="w-6 h-6 items-center justify-center">
                        <Avatar
                          fallback={
                            employee.customer?.first_name?.charAt(0) || ""
                          }
                        />
                      </Table.Cell>
                      <Table.Cell className="flex w-fit gap-2 items-center">
                        {employee.customer?.first_name}{" "}
                        {employee.customer?.last_name}
                        {employee.is_admin && (
                          <Badge
                            size="2xsmall"
                            color={employee.is_admin ? "green" : "grey"}
                          >
                            Admin
                          </Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell>{employee.customer?.email}</Table.Cell>
                      <Table.Cell>
                        {formatAmount(
                          employee.spending_limit,
                          company?.currency_code || "USD"
                        )}
                      </Table.Cell>
                      <Table.Cell onClick={(e) => e.stopPropagation()}>
                        <EmployeesActionsMenu
                          company={company}
                          employee={employee}
                        />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <div className="flex h-[400px] w-full flex-col items-center justify-center gap-y-4">
                <div className="flex flex-col items-center gap-y-3">
                  <ExclamationCircle />
                  <div className="flex flex-col items-center gap-y-1">
                    <Text className="font-medium font-sans txt-compact-small">
                      No records
                    </Text>
                    <Text className="txt-small text-ui-fg-muted">
                      This company doesn't have any employees.
                    </Text>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Container>
      <Toaster />
    </div>
  );
};

export default CompanyDetails;
