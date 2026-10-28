import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { layoutEntry as entry } from "../../../__tests__/layout-queries";
import CompanyDetails from "../[companyId]/page";
import { sdk } from "../../../lib/client";
import type {
  AdminBusinessCentralCustomerLookupResponse,
  AdminBusinessCentralCustomerLookupResult,
  AdminBusinessCentralCustomerResponse,
  AdminUseBusinessCentralCustomerResponse,
  QueryCompany,
} from "../../../../types";

// Mock the SDK boundary only; hooks, section, prompt, menu and toasts run for real.
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

const COMPANY_URL = "/admin/companies/comp_1";
const STATUS_URL = `${COMPANY_URL}/business-central-customer`;
const LOOKUP_URL = `${STATUS_URL}/lookup`;
const USE_URL = `${STATUS_URL}/use`;
const SYNC_URL = `${COMPANY_URL}/sync-business-central`;
const NOT_FOUND_AT = "2026-10-26T10:15:00.000Z";

// The SDK rejects a non-2xx answer with a FetchError carrying `status`; the real class cannot be
// loaded under jsdom (its module needs TransformStream), so the test builds the same shape.
function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

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
    country: "no",
    logo_url: null,
    currency_code: "nok",
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

function status(
  patch: Partial<AdminBusinessCentralCustomerResponse> = {}
): AdminBusinessCentralCustomerResponse {
  return {
    routed_environment: "NO",
    customer_number: "C100",
    not_found: null,
    ...patch,
  };
}

const found = (
  environment: "DK" | "NO",
  customer: Partial<NonNullable<AdminBusinessCentralCustomerLookupResult["customer"]>> = {}
): AdminBusinessCentralCustomerLookupResult => ({
  environment,
  status: "found",
  customer: {
    name: `Acme ${environment}`,
    country: "NO",
    routes_to: "NO",
    routes_elsewhere: environment !== "NO",
    ...customer,
  },
});
const notFound = (environment: "DK" | "NO"): AdminBusinessCentralCustomerLookupResult => ({
  environment,
  status: "not_found",
  customer: null,
});
const couldNotCheck = (environment: "DK" | "NO"): AdminBusinessCentralCustomerLookupResult => ({
  environment,
  status: "could_not_check",
  customer: null,
});

function lookupOf(
  dk: AdminBusinessCentralCustomerLookupResult,
  no: AdminBusinessCentralCustomerLookupResult
): () => Promise<AdminBusinessCentralCustomerLookupResponse> {
  return async () => ({ customer_number: "C100", results: [dk, no] });
}

type Serve = {
  companies?: CompanyJson[];
  statuses?: AdminBusinessCentralCustomerResponse[];
  lookup?: () => Promise<AdminBusinessCentralCustomerLookupResponse>;
  use?: () => Promise<AdminUseBusinessCentralCustomerResponse>;
  sync?: () => Promise<unknown>;
};

// Reads answer from a queue whose last reply repeats; actions from their handler or throw.
function serve({ companies = [company()], statuses = [status()], lookup, use, sync }: Serve) {
  const companyQueue = [...companies];
  const statusQueue = [...statuses];
  const next = <T,>(queue: T[]): T => (queue.length > 1 ? queue.splice(0, 1)[0] : queue[0]);
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    if (url === LOOKUP_URL && method === "GET") {
      if (!lookup) throw new Error("Unexpected lookup request");
      return lookup();
    }
    if (url === USE_URL && method === "POST") {
      if (!use) throw new Error("Unexpected use request");
      return use();
    }
    if (url === SYNC_URL && method === "POST") {
      if (!sync) throw new Error("Unexpected sync request");
      return sync();
    }
    if (url === STATUS_URL && method === "GET") return next(statusQueue);
    if (url.startsWith(`${COMPANY_URL}?`) && method === "GET") {
      return { company: next(companyQueue) };
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  });
}

function calls(url: string, method: string) {
  return fetchMock.mock.calls.filter(
    ([callUrl, init]) => callUrl === url && (init?.method ?? "GET") === method
  );
}

function companyReads() {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(`${COMPANY_URL}?`))
    .length;
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

async function section() {
  await screen.findByRole("heading", { name: /Acme/ });
  const element = entry("business-central-customer");
  await within(element).findByText("Routed environment");
  return element;
}

async function check(user: ReturnType<typeof userEvent.setup>) {
  const element = await section();
  await user.click(
    within(element).getByRole("button", { name: "Check customer number in DK and NO" })
  );
  return element;
}

function result(element: HTMLElement, environment: "DK" | "NO") {
  return within(element).getByRole("group", { name: `Business Central ${environment}` });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Company page: Business Central customer section", () => {
  it("shows the routed environment and the not-found time, environment and number", async () => {
    serve({
      statuses: [
        status({
          routed_environment: "NO",
          not_found: { at: NOT_FOUND_AT, environment: "DK", customer_number: "C099" },
        }),
      ],
    });
    renderPage();

    const element = await section();
    const routed = within(element).getByRole("row", { name: /Routed environment/ });
    expect(routed).toHaveTextContent("NO");
    const record = within(element).getByRole("row", { name: /Customer not found/ });
    expect(record).toHaveTextContent(new Date(NOT_FOUND_AT).toLocaleString());
    expect(record).toHaveTextContent("DK");
    expect(record).toHaveTextContent("C099");
  });

  it("shows no not-found record when there is none", async () => {
    serve({ statuses: [status({ routed_environment: "DK", not_found: null })] });
    renderPage();

    const element = await section();
    expect(within(element).getByRole("row", { name: /Routed environment/ })).toHaveTextContent(
      "DK"
    );
    expect(within(element).getByRole("row", { name: /Customer not found/ })).toHaveTextContent(
      "None"
    );
    expect(within(element).queryByText("C099")).toBeNull();
  });

  it("disables the check without a customer number and makes no lookup", async () => {
    serve({
      companies: [company({ business_central_customer_number: null })],
      statuses: [status({ customer_number: null })],
    });
    const user = userEvent.setup();
    renderPage();

    const element = await section();
    const button = within(element).getByRole("button", {
      name: "Check customer number in DK and NO",
    });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(calls(LOOKUP_URL, "GET")).toHaveLength(0);
  });

  it("runs the lookup only on click", async () => {
    serve({ lookup: lookupOf(notFound("DK"), found("NO")) });
    const user = userEvent.setup();
    renderPage();

    const element = await section();
    expect(calls(LOOKUP_URL, "GET")).toHaveLength(0);
    await user.click(
      within(element).getByRole("button", { name: "Check customer number in DK and NO" })
    );
    await within(element).findByRole("group", { name: "Business Central NO" });
    expect(calls(LOOKUP_URL, "GET")).toHaveLength(1);
  });

  it("offers one Use this customer when the card is found in one environment", async () => {
    serve({ lookup: lookupOf(notFound("DK"), found("NO")) });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const no = await within(element).findByRole("group", { name: "Business Central NO" });
    expect(no).toHaveTextContent("Acme NO");
    expect(no).toHaveTextContent("NO");
    expect(within(no).getByRole("button", { name: "Use this customer" })).toBeEnabled();
    const dk = result(element, "DK");
    expect(dk).toHaveTextContent("Not found");
    expect(within(dk).queryByRole("button", { name: "Use this customer" })).toBeNull();
    expect(within(element).getAllByRole("button", { name: "Use this customer" })).toHaveLength(1);
  });

  it("offers both actions and no warning when the card is found in both", async () => {
    serve({
      lookup: lookupOf(
        found("DK", { routes_to: "DK", country: "DK", routes_elsewhere: false }),
        found("NO", { routes_to: "NO", country: "NO", routes_elsewhere: false })
      ),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    await within(element).findByRole("group", { name: "Business Central DK" });
    expect(within(result(element, "DK")).getByRole("button", { name: "Use this customer" }))
      .toBeEnabled();
    expect(within(result(element, "NO")).getByRole("button", { name: "Use this customer" }))
      .toBeEnabled();
    expect(within(element).queryByText(/routes the company to/)).toBeNull();
  });

  it("shows a message and no action when the card is found in neither", async () => {
    serve({ lookup: lookupOf(notFound("DK"), notFound("NO")) });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    expect(
      await within(element).findByText(
        "Business Central has no customer C100 in DK or NO."
      )
    ).toBeVisible();
    expect(within(element).queryByRole("button", { name: "Use this customer" })).toBeNull();
  });

  it("shows could not check per environment beside the other environment's result", async () => {
    serve({
      lookup: lookupOf(couldNotCheck("DK"), found("NO", { routes_elsewhere: false })),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const dk = await within(element).findByRole("group", { name: "Business Central DK" });
    expect(dk).toHaveTextContent("Could not check");
    expect(within(dk).queryByRole("button", { name: "Use this customer" })).toBeNull();
    const no = result(element, "NO");
    expect(no).toHaveTextContent("Acme NO");
    expect(within(no).getByRole("button", { name: "Use this customer" })).toBeEnabled();
    expect(within(element).queryByText(/has no customer/)).toBeNull();
  });

  it("shows an error when the lookup request fails", async () => {
    serve({ lookup: () => Promise.reject(httpError(500, "Internal Server Error")) });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    expect(
      await within(element).findByText("Could not check the customer number. Try again.")
    ).toBeVisible();
  });

  it("warns when the card routes elsewhere and posts nothing when the confirmation is cancelled", async () => {
    serve({
      lookup: lookupOf(found("DK", { routes_to: "NO", routes_elsewhere: true }), notFound("NO")),
      use: async () => ({ status: "updated", country: "NO" }),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const dk = await within(element).findByRole("group", { name: "Business Central DK" });
    expect(dk).toHaveTextContent("routes the company to NO");

    await user.click(within(dk).getByRole("button", { name: "Use this customer" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("NO");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(calls(USE_URL, "POST")).toHaveLength(0);
  });

  it("posts only the environment after the routes-elsewhere confirmation", async () => {
    serve({
      lookup: lookupOf(found("DK", { routes_to: "NO", routes_elsewhere: true }), notFound("NO")),
      use: async () => ({ status: "updated", country: "NO" }),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const dk = await within(element).findByRole("group", { name: "Business Central DK" });
    await user.click(within(dk).getByRole("button", { name: "Use this customer" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Use this customer" }));

    await waitFor(() => expect(calls(USE_URL, "POST")).toHaveLength(1));
    expect(calls(USE_URL, "POST")[0][1]).toEqual(
      expect.objectContaining({ method: "POST", body: { environment: "DK" } })
    );
  });

  it("posts directly, without a confirmation, when the card routes to its own environment", async () => {
    serve({
      lookup: lookupOf(notFound("DK"), found("NO", { routes_elsewhere: false })),
      use: async () => ({ status: "updated", country: "NO" }),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const no = await within(element).findByRole("group", { name: "Business Central NO" });
    await user.click(within(no).getByRole("button", { name: "Use this customer" }));

    await waitFor(() => expect(calls(USE_URL, "POST")).toHaveLength(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(calls(USE_URL, "POST")[0][1]).toEqual(
      expect.objectContaining({ body: { environment: "NO" } })
    );
  });

  it.each([
    ["updated", "Business Central customer set"],
    ["skipped", "Country set, but nothing was synced"],
    ["failed", "Country set, but the Business Central sync failed"],
  ] as const)(
    "shows the %s outcome and reloads the company and the section",
    async (outcome, message) => {
      serve({
        statuses: [
          status({
            routed_environment: "DK",
            not_found: { at: NOT_FOUND_AT, environment: "DK", customer_number: "C100" },
          }),
          status({ routed_environment: "NO", not_found: null }),
        ],
        lookup: lookupOf(notFound("DK"), found("NO", { routes_elsewhere: false })),
        use: async () => ({ status: outcome, country: "NO" }),
      });
      const user = userEvent.setup();
      renderPage();

      const element = await check(user);
      const no = await within(element).findByRole("group", { name: "Business Central NO" });
      const companyReadsBefore = companyReads();
      await user.click(within(no).getByRole("button", { name: "Use this customer" }));

      expect(await screen.findByText(message)).toBeVisible();
      await waitFor(() => expect(companyReads()).toBeGreaterThan(companyReadsBefore));
      await waitFor(() =>
        expect(within(element).getByRole("row", { name: /Routed environment/ }))
          .toHaveTextContent("NO")
      );
      expect(within(element).getByRole("row", { name: /Customer not found/ }))
        .toHaveTextContent("None");
    }
  );

  it("explains a 404 from Use this customer and still reloads", async () => {
    serve({
      lookup: lookupOf(notFound("DK"), found("NO", { routes_elsewhere: false })),
      use: () => Promise.reject(httpError(404, "Not Found")),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await check(user);
    const no = await within(element).findByRole("group", { name: "Business Central NO" });
    const statusReadsBefore = calls(STATUS_URL, "GET").length;
    await user.click(within(no).getByRole("button", { name: "Use this customer" }));

    expect(
      await screen.findByText("Business Central no longer has this customer in NO")
    ).toBeVisible();
    await waitFor(() =>
      expect(calls(STATUS_URL, "GET").length).toBeGreaterThan(statusReadsBefore)
    );
  });

  it("reloads the section after Sync from Business Central", async () => {
    serve({
      statuses: [
        status({ not_found: null }),
        status({
          not_found: { at: NOT_FOUND_AT, environment: "NO", customer_number: "C100" },
        }),
      ],
      sync: async () => ({ status: "skipped" }),
    });
    const user = userEvent.setup();
    renderPage();

    const element = await section();
    await user.click(within(entry("company-information")).getByRole("button"));
    await user.click(
      await screen.findByRole("menuitem", { name: "Sync from Business Central" })
    );

    await waitFor(() =>
      expect(within(element).getByRole("row", { name: /Customer not found/ }))
        .toHaveTextContent(new Date(NOT_FOUND_AT).toLocaleString())
    );
  });
});
