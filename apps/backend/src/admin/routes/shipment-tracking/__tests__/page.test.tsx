import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@medusajs/ui";
import ShipmentTrackingPage from "../page";
import { sdk } from "../../../lib/client";

jest.mock("../../../lib/client", () => ({ sdk: { client: { fetch: jest.fn() } } }));
jest.mock("@medusajs/ui", () => ({ ...jest.requireActual("@medusajs/ui"), toast: { error: jest.fn(), success: jest.fn() } }));
const fetchMock = jest.mocked(sdk.client.fetch);
const LIST = "/admin/shipment-tracking";
const OVERVIEW = "/admin/shipment-tracking/overview";
const RETRY = "/admin/shipment-tracking/shtr_1/retry";
const page = {
  shipment_trackings: [{ id: "shtr_1", shipment_number: "SS-1", bc_order_number: "SO-1",
    order_id: "order_1", external_order_number: "EXT-1", company_id: "comp_1",
    company_name: "Test company", attempts: 9, last_error: "bc_missing", closed_at: "2026-10-01T00:00:00.000Z" }],
  count: 1, limit: 20, offset: 0,
};
const overview = {
  shipment_trackings: [
    { id: "shtr_10", shipment_number: "SS-10", bc_order_number: "SO-10", external_order_number: "EXT-10",
      company_id: "comp_1", company_name: "Overview company", posting_date: "2026-10-02", state: "open", close_reason: null },
    { id: "shtr_11", shipment_number: "SS-11", bc_order_number: "SO-11", external_order_number: "EXT-11",
      company_id: "comp_2", company_name: null, posting_date: "2026-10-01", state: "closed", close_reason: "window_ended" },
  ],
  count: 2, limit: 50, offset: 0,
};
type Reply = () => Promise<unknown>;

function deferred<T>() {
  let complete: (value: T) => void;
  const promise = new Promise<T>((resolve) => { complete = resolve; });
  return { promise, resolve: (value: T) => complete(value) };
}
// Each URL answers from its own queue (the last reply repeats), so the two sections' requests
// can arrive in any order.
function serve(replies: Record<string, Reply[]>) {
  const queues = new Map(Object.entries(replies));
  fetchMock.mockImplementation(async (url: string) => {
    const queue = queues.get(url) ?? [];
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    if (!reply) throw new Error(`Unexpected request ${url}`);
    return reply();
  });
}
const ok = (value: unknown): Reply => () => Promise.resolve(value);
const fail = (message: string): Reply => () => Promise.reject(new Error(message));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><ShipmentTrackingPage /></QueryClientProvider>);
  return { invalidate };
}
const allShipments = () => screen.getByRole("region", { name: "All shipments" });
beforeEach(() => jest.clearAllMocks());

it("shows a spinner until loading finishes, then shipment recovery details", async () => {
  const read = deferred<typeof page>();
  serve({ [LIST]: [() => read.promise], [OVERVIEW]: [ok(overview)] });
  mount();
  expect(screen.getAllByRole("status")[0]).toHaveTextContent("Loading shipment tracking");
  await act(async () => read.resolve(page));
  expect(await screen.findByText("SS-1")).toBeVisible();
  expect(screen.getByText("Test company")).toBeVisible();
  expect(screen.getByText("bc_missing")).toBeVisible();
});

it("disables retry while pending and invalidates the list so the reopened row disappears", async () => {
  const retry = deferred<{ shipment_tracking: { id: string } }>();
  serve({
    [LIST]: [ok(page), ok({ ...page, shipment_trackings: [], count: 0 })],
    [RETRY]: [() => retry.promise], [OVERVIEW]: [ok(overview)],
  });
  const { invalidate } = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Retry" }));
  expect(screen.getByRole("button", { name: /Retry/ })).toBeDisabled();
  await act(async () => retry.resolve({ shipment_tracking: { id: "shtr_1" } }));
  await waitFor(() => expect(screen.queryByText("SS-1")).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shipment-tracking"] });
  expect(fetchMock).toHaveBeenCalledWith(RETRY, { method: "POST", body: {} });
});

it("shows a toast when retry fails and keeps the row", async () => {
  serve({ [LIST]: [ok(page)], [RETRY]: [fail("Retry failed")], [OVERVIEW]: [ok(overview)] });
  mount();
  await userEvent.setup().click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Retry failed"));
  expect(screen.getByText("SS-1")).toBeVisible();
});

it("shows a load error instead of an empty success state", async () => {
  serve({ [LIST]: [fail("List unavailable")], [OVERVIEW]: [ok(overview)] });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("List unavailable");
});

it("lists all shipments below the given-up section with their status", async () => {
  serve({ [LIST]: [ok(page)], [OVERVIEW]: [ok(overview)] });
  mount();
  const section = allShipments();
  expect(await within(section).findByText("SS-10")).toBeVisible();
  expect(screen.getByText("SS-1").compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const [open, closed] = within(section).getAllByRole("row").slice(1);
  expect(within(open).getByText("Overview company")).toBeVisible();
  expect(within(open).getByText("2026-10-02")).toBeVisible();
  expect(within(open).getByText("Open")).toBeVisible();
  expect(within(closed).getByText("comp_2")).toBeVisible();
  expect(within(closed).getByText("Closed: window ended")).toBeVisible();
  expect(within(section).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(OVERVIEW, { method: "GET", query: { limit: 50, offset: 0 } });
});

it("pages the overview by 50 independently of the given-up list", async () => {
  serve({ [LIST]: [ok(page)], [OVERVIEW]: [ok({ ...overview, count: 120 })] });
  mount();
  const section = allShipments();
  await within(section).findByText("SS-10");
  await userEvent.setup().click(within(section).getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(OVERVIEW, { method: "GET", query: { limit: 50, offset: 50 } }));
  expect(fetchMock).not.toHaveBeenCalledWith(LIST, { method: "GET", query: { limit: 20, offset: 20 } });
});

it("shows the overview's own load error while the given-up list still renders", async () => {
  serve({ [LIST]: [ok(page)], [OVERVIEW]: [fail("Overview unavailable")] });
  mount();
  expect(await within(allShipments()).findByRole("alert")).toHaveTextContent("Overview unavailable");
  expect(screen.getByText("SS-1")).toBeVisible();
});
