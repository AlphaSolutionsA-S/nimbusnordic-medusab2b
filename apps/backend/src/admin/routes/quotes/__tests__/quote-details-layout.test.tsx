import { CORE_LAYOUT_IDS } from "@medusajs/admin-shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuoteDetails from "../[quoteId]/page";
import { sdk } from "../../../lib/client";
import { QUOTE_DETAILS_PAGE_KEY } from "../../../lib/page-keys";

// Mock the SDK boundary only; hooks and components above it run for real. The preview mock is
// untyped so the fixture can carry only the fields the page reads.
const previewMock = jest.fn();
jest.mock("../../../lib/client", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    admin: { order: { retrievePreview: (...args: unknown[]) => previewMock(...args) } },
  },
}));
const fetchMock = jest.mocked(sdk.client.fetch);

// Plain response bodies: only the fields the page and its sections read.
function draftOrder() {
  return {
    id: "order_1",
    currency_code: "dkk",
    items: [],
    total: 1000,
    discount_total: 0,
    shipping_methods: [],
    customer: { id: "cus_1", email: "ada@example.com", phone: "12345678" },
  };
}

function quote(patch: { status?: string } = {}) {
  return {
    id: "quote_1",
    status: "accepted",
    draft_order_id: "order_1",
    draft_order: draftOrder(),
    customer: {
      id: "cus_1",
      employee: {
        id: "emp_1",
        spending_limit: 500,
        company: { id: "comp_1", name: "Acme", currency_code: "dkk" },
      },
    },
    messages: [],
    ...patch,
  };
}

function preview() {
  return {
    id: "order_1",
    items: [],
    summary: { current_order_total: 900 },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/quotes/quote_1"]}>
        <Routes>
          <Route path="/quotes/:quoteId" element={<QuoteDetails />} />
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

function entryIds(section: Element): (string | null)[] {
  return Array.from(section.querySelectorAll("[data-layout-entry]")).map((el) =>
    el.getAttribute("data-layout-entry")
  );
}

function section(layout: HTMLElement, name: "main" | "side"): Element {
  const element = layout.querySelector(`[data-layout-section="${name}"]`);
  if (!element) throw new Error(`no layout section "${name}"`);
  return element;
}

beforeEach(() => {
  fetchMock.mockReset();
  previewMock.mockReset();
  previewMock.mockResolvedValue({ order: preview() });
});

describe("Quote details page layout", () => {
  it("renders notice, quote, messages and JSON in main and customer, company in side, under quote.details", async () => {
    fetchMock.mockResolvedValue({ quote: quote({ status: "accepted" }) });
    renderPage();

    const layout = await screen.findByTestId("layout-composer");
    expect(layout).toHaveAttribute("data-page-key", QUOTE_DETAILS_PAGE_KEY);
    expect(layout).toHaveAttribute("data-layout-id", CORE_LAYOUT_IDS.TWO_COLUMN);
    expect(entryIds(section(layout, "main"))).toEqual([
      "quote-accepted",
      "quote",
      "messages",
      "json",
    ]);
    expect(entryIds(section(layout, "side"))).toEqual(["customer", "company"]);

    expect(
      within(entry("quote-accepted")).getByText(/Quote accepted by customer/)
    ).toBeVisible();
    expect(
      within(entry("quote-accepted")).getByRole("button", { name: "View Order" })
    ).toBeVisible();
    expect(within(entry("quote")).getByRole("heading", { name: "Quote Summary" })).toBeVisible();
    expect(within(entry("quote")).queryByRole("button", { name: "Send Quote" })).toBeNull();
    expect(within(entry("quote")).queryByRole("button", { name: "Reject Quote" })).toBeNull();
    expect(within(entry("messages")).getByRole("heading", { name: "Messages" })).toBeVisible();

    const customer = entry("customer");
    expect(within(customer).getByRole("heading", { name: "Customer" })).toBeVisible();
    expect(within(customer).getByRole("link", { name: "ada@example.com" })).toHaveAttribute(
      "href",
      "/customers/cus_1"
    );
    const company = entry("company");
    expect(within(company).getByRole("heading", { name: "Company" })).toBeVisible();
    expect(within(company).getByRole("link", { name: "Acme" })).toHaveAttribute(
      "href",
      "/companies/comp_1"
    );
  });

  it("has no notice entry and shows Send and Reject when the quote awaits the merchant", async () => {
    fetchMock.mockResolvedValue({ quote: quote({ status: "pending_merchant" }) });
    renderPage();

    const layout = await screen.findByTestId("layout-composer");
    expect(entryIds(section(layout, "main"))).toEqual(["quote", "messages", "json"]);
    expect(screen.queryByText(/Quote accepted by customer/)).toBeNull();

    const quoteEntry = entry("quote");
    expect(within(quoteEntry).getByRole("button", { name: "Send Quote" })).toBeEnabled();
    expect(within(quoteEntry).getByRole("button", { name: "Reject Quote" })).toBeEnabled();
  });

  it("renders no layout while the order preview is loading", async () => {
    fetchMock.mockResolvedValue({ quote: quote() });
    previewMock.mockReturnValue(new Promise(() => undefined));
    renderPage();

    await waitFor(() => expect(previewMock).toHaveBeenCalledWith("order_1", {}));
    expect(screen.queryByTestId("layout-composer")).toBeNull();
  });
});
