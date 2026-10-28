import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { layoutEntry as entry } from "../../../__tests__/layout-queries";
import CompanyDetails from "../[companyId]/page";
import { sdk } from "../../../lib/client";
import type { QueryCompany } from "../../../../types";

// Mock the SDK boundary only; hooks, menu, toasts and the page run for real.
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

const SYNC_URL = "/admin/companies/comp_1/sync-business-central";
const BC_CUSTOMER_URL = "/admin/companies/comp_1/business-central-customer";
const SYNCED_AT = "2026-10-26T10:15:00.000Z";

// Over HTTP the last-synced time is an ISO string or null, not the Date QueryCompany declares.
type CompanyJson = Omit<QueryCompany, "business_central_synced_at"> & {
  business_central_synced_at: string | null;
};

function company(patch: Partial<CompanyJson> = {}): CompanyJson {
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
  } as CompanyJson;
}

// The company read answers from a queue (the last reply repeats); the sync POST from `sync`; the
// Business Central customer section's status read with a fixed status.
function serve(reads: CompanyJson[], sync?: () => Promise<unknown>) {
  const queue = [...reads];
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url === SYNC_URL && init?.method === "POST") {
      if (!sync) throw new Error("Unexpected sync request");
      return sync();
    }
    if (url === BC_CUSTOMER_URL && init?.method === "GET") {
      return { routed_environment: "DK", customer_number: "C100", not_found: null };
    }
    if (url.startsWith("/admin/companies/comp_1?") && init?.method === "GET") {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return { company: next };
    }
    throw new Error(`Unexpected request ${init?.method} ${url}`);
  });
}

function syncCalls() {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url === SYNC_URL && init?.method === "POST"
  );
}

function companyReads() {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).startsWith("/admin/companies/comp_1?") && init?.method === "GET"
  ).length;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: /Acme/ });
  const information = entry("company-information");
  await user.click(within(information).getByRole("button"));
  return screen.findByRole("menuitem", { name: "Sync from Business Central" });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Company page: Sync from Business Central", () => {
  it("posts an empty body for the company and shows the refetched values and last-synced time", async () => {
    serve(
      [company(), company({ name: "Acme BC", business_central_synced_at: SYNCED_AT })],
      async () => ({ status: "updated" })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await openMenu(user));

    expect(await screen.findByText("Company synced from Business Central")).toBeVisible();
    expect(syncCalls()).toHaveLength(1);
    expect(syncCalls()[0][1]).toMatchObject({ method: "POST", body: {} });
    expect(await screen.findByRole("heading", { name: "Acme BC" })).toBeVisible();
    const row = screen.getByRole("row", { name: /Last synced from Business Central/ });
    expect(within(row).getByText(new Date(SYNCED_AT).toLocaleString())).toBeVisible();
  });

  it.each([
    ["skipped", "Nothing to sync"],
    ["failed", /nothing was changed/],
  ])("shows the %s outcome and refetches the company", async (status, message) => {
    serve([company()], async () => ({ status }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await openMenu(user));

    expect(await screen.findByText(message)).toBeVisible();
    await waitFor(() => expect(companyReads()).toBeGreaterThan(1));
  });

  it("shows a generic error when the sync request fails", async () => {
    serve([company()], () => Promise.reject(new Error("Internal Server Error")));
    const user = userEvent.setup();
    renderPage();

    await user.click(await openMenu(user));

    expect(
      await screen.findByText("Could not sync the company from Business Central")
    ).toBeVisible();
    expect(screen.queryByText("Company synced from Business Central")).toBeNull();
    await waitFor(() => expect(companyReads()).toBeGreaterThan(1));
  });

  it("disables the action without a BC customer number, explains why and makes no request", async () => {
    serve([company({ business_central_customer_number: null })]);
    const user = userEvent.setup();
    renderPage();

    const item = await openMenu(user);
    expect(item).toHaveAttribute("aria-disabled", "true");

    await user.hover(item);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Add a Business Central customer number to sync this company."
    );

    await user.click(item);
    expect(syncCalls()).toHaveLength(0);
  });

  it("keeps the existing menu actions", async () => {
    serve([company()]);
    const user = userEvent.setup();
    renderPage();

    await openMenu(user);
    for (const name of ["Edit details", "Manage customer group", "Approval settings", "Delete"]) {
      expect(screen.getByRole("menuitem", { name })).not.toHaveAttribute("aria-disabled");
    }
  });
});

describe("Company page: last synced from Business Central", () => {
  it.each([
    [null, "Never"],
    [SYNCED_AT, new Date(SYNCED_AT).toLocaleString()],
  ])("shows %s as %s", async (syncedAt, shown) => {
    serve([company({ business_central_synced_at: syncedAt })]);
    renderPage();

    const row = await screen.findByRole("row", {
      name: /Last synced from Business Central/,
    });
    expect(within(row).getByText(shown)).toBeVisible();
  });
});
