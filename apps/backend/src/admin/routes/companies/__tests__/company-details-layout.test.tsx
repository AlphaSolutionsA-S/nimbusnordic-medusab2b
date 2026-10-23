import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CompanyDetails from "../[companyId]/page";
import {
  BC_MANAGED_WARNING_DESCRIPTION,
  BC_MANAGED_WARNING_TITLE,
} from "../bc-managed-fields";
import { sdk } from "../../../lib/client";
import { COMPANY_DETAILS_PAGE_KEY } from "../../../lib/page-keys";
import type { QueryCompany, QueryEmployee } from "../../../../types";

// Mock the SDK boundary only; hooks and components above it run for real.
jest.mock("../../../lib/client", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    admin: { customerGroup: { list: jest.fn() } },
  },
}));
const fetchMock = jest.mocked(sdk.client.fetch);
jest.mocked(sdk.admin.customerGroup.list).mockResolvedValue({
  customer_groups: [],
  count: 0,
  offset: 0,
  limit: 50,
});

function employee(): QueryEmployee {
  return {
    id: "emp_1",
    spending_limit: 1000,
    is_admin: true,
    customer: {
      id: "cus_1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    },
  } as QueryEmployee;
}

function company(patch: Partial<QueryCompany> = {}): QueryCompany {
  return {
    id: "comp_1",
    name: "Acme",
    email: "acme@example.com",
    phone: "12345678",
    address: null,
    city: null,
    state: null,
    zip: null,
    country: "dk",
    logo_url: null,
    currency_code: "dkk",
    business_central_customer_number: "C100",
    business_central_synced_at: null,
    blocked: "not_blocked",
    credit_limit: null,
    vat_number: null,
    spending_limit_reset_frequency: "never",
    order_api_enabled: true,
    created_at: new Date("2026-10-01T00:00:00.000Z"),
    updated_at: new Date("2026-10-01T00:00:00.000Z"),
    employees: [],
    approval_settings: {
      requires_admin_approval: false,
      requires_sales_manager_approval: false,
    },
    carts: [],
    ...patch,
  } as QueryCompany;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/companies/comp_1"]}>
        <Routes>
          <Route path="/companies/:companyId" element={<CompanyDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function entry(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-layout-entry="${id}"]`);
  if (!element) throw new Error(`no layout entry "${id}"`);
  return element;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Company details page layout", () => {
  it("renders the warning, company information and employees as entries, in that order, under company.details", async () => {
    fetchMock.mockResolvedValue({ company: company() });
    renderPage();

    const layout = await screen.findByTestId("layout-composer");
    expect(layout).toHaveAttribute("data-page-key", COMPANY_DETAILS_PAGE_KEY);
    expect(layout).toHaveAttribute("data-layout-id", CORE_LAYOUT_IDS.SINGLE_COLUMN);
    expect(
      Array.from(layout.querySelectorAll("[data-layout-entry]")).map((el) =>
        el.getAttribute("data-layout-entry")
      )
    ).toEqual(["business-central-warning", "company-information", "employees"]);
  });

  it("keeps the Business Central warning text, the Order API row and the employees table in their sections", async () => {
    fetchMock.mockResolvedValue({ company: company({ employees: [employee()] }) });
    renderPage();
    await screen.findByTestId("layout-composer");

    const warning = entry("business-central-warning");
    expect(within(warning).getByText(BC_MANAGED_WARNING_TITLE)).toBeVisible();
    expect(within(warning).getByText(BC_MANAGED_WARNING_DESCRIPTION)).toBeVisible();

    const information = entry("company-information");
    expect(within(information).getByRole("heading", { name: "Acme" })).toBeVisible();
    const orderApiRow = within(information).getByRole("row", { name: /Order API/ });
    expect(within(orderApiRow).getByText("Enabled")).toBeVisible();

    const employees = entry("employees");
    expect(within(employees).getByRole("heading", { name: "Employees" })).toBeVisible();
    const employeeRow = within(employees).getByRole("row", { name: /Ada Lovelace/ });
    expect(within(employeeRow).getByText("ada@example.com")).toBeVisible();
  });

  it("shows the employees empty state when the company has no employees", async () => {
    fetchMock.mockResolvedValue({ company: company({ employees: [] }) });
    renderPage();
    await screen.findByTestId("layout-composer");

    const employees = entry("employees");
    expect(within(employees).getByText("No records")).toBeVisible();
    expect(within(employees).getByText("This company doesn't have any employees.")).toBeVisible();
    expect(within(employees).queryByRole("table")).toBeNull();
  });

  it("shows Company not found and no layout while the company is loading", () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getByText("Company not found")).toBeVisible();
    expect(screen.queryByTestId("layout-composer")).toBeNull();
  });
});
