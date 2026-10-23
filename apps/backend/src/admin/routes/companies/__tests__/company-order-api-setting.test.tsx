import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import CompanyDetails from "../[companyId]/page";
import { CompanyCreateDrawer, CompanyUpdateDrawer } from "../components";
import { BC_MANAGED_INDICATOR_LABEL } from "../bc-managed-fields";
import { sdk } from "../../../lib/client";
import type { QueryCompany } from "../../../../types";

// Mock the SDK boundary only; everything above it (hooks, drawers, form) runs for real.
jest.mock("../../../lib/client", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    admin: {
      region: { list: jest.fn() },
      customerGroup: { list: jest.fn() },
    },
  },
}));
const fetchMock = jest.mocked(sdk.client.fetch);
jest.mocked(sdk.admin.region.list).mockResolvedValue({
  regions: [],
  count: 0,
  offset: 0,
  limit: 50,
});
jest.mocked(sdk.admin.customerGroup.list).mockResolvedValue({
  customer_groups: [],
  count: 0,
  offset: 0,
  limit: 50,
});

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
    order_api_enabled: false,
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

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function postBodies(url: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([calledUrl, init]) => calledUrl === url && init?.method === "POST")
    .map(([, init]) => init?.body);
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Company detail page: order API setting", () => {
  it.each([
    [true, "Enabled"],
    [false, "Disabled"],
  ])("shows order_api_enabled=%s as %s", async (enabled, label) => {
    fetchMock.mockResolvedValue({ company: company({ order_api_enabled: enabled }) });
    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/companies/comp_1"]}>
          <Routes>
            <Route path="/companies/:companyId" element={<CompanyDetails />} />
          </Routes>
        </MemoryRouter>
      )
    );

    const row = await screen.findByRole("row", { name: /Order API/ });
    expect(within(row).getByText(label)).toBeVisible();
    // Medusa-only setting: no Business Central-managed indicator on its row.
    expect(within(row).queryByText(BC_MANAGED_INDICATOR_LABEL)).toBeNull();
  });
});

describe("Company drawers: order API switch", () => {
  it.each([
    [false, true],
    [true, false],
  ])(
    "edit drawer: switching from %s submits order_api_enabled=%s",
    async (initial, expected) => {
      fetchMock.mockResolvedValue({ company: company({ order_api_enabled: expected }) });
      const user = userEvent.setup();
      render(
        withQueryClient(
          <CompanyUpdateDrawer
            company={company({ order_api_enabled: initial })}
            open
            setOpen={jest.fn()}
          />
        )
      );

      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAttribute("aria-checked", String(initial));
      expect(screen.getByText("Order API")).toBeVisible();
      await user.click(toggle);
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(postBodies("/admin/companies/comp_1")).toHaveLength(1));
      expect(postBodies("/admin/companies/comp_1")[0]).toMatchObject({
        order_api_enabled: expected,
      });
    }
  );

  it("create drawer: renders no switch and submits no order_api_enabled", async () => {
    fetchMock.mockResolvedValue({ company: company() });
    const user = userEvent.setup();
    render(withQueryClient(<CompanyCreateDrawer />));

    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Create Company");
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Order API")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(postBodies("/admin/companies")).toHaveLength(1));
    expect(postBodies("/admin/companies")[0]).not.toHaveProperty("order_api_enabled");
  });
});
