import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@medusajs/ui";
import ShipmentTrackingPage from "../page";
import { sdk } from "../../../lib/client";

jest.mock("../../../lib/client", () => ({ sdk: { client: { fetch: jest.fn() } } }));
jest.mock("@medusajs/ui", () => ({ ...jest.requireActual("@medusajs/ui"), toast: { error: jest.fn(), success: jest.fn() } }));
const fetchMock = jest.mocked(sdk.client.fetch);
const page = {
  shipment_trackings: [{ id: "shtr_1", shipment_number: "SS-1", bc_order_number: "SO-1",
    order_id: "order_1", external_order_number: "EXT-1", company_id: "comp_1",
    company_name: "Test company", attempts: 9, last_error: "bc_missing", closed_at: "2026-10-01T00:00:00.000Z" }],
  count: 1, limit: 20, offset: 0,
};
function deferred<T>() {
  let complete: (value: T) => void;
  const promise = new Promise<T>((resolve) => { complete = resolve; });
  return { promise, resolve: (value: T) => complete(value) };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><ShipmentTrackingPage /></QueryClientProvider>);
  return { invalidate };
}
beforeEach(() => jest.clearAllMocks());

it("shows a spinner until loading finishes, then shipment recovery details", async () => {
  const read = deferred<typeof page>();
  fetchMock.mockReturnValueOnce(read.promise);
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("Loading shipment tracking");
  await act(async () => read.resolve(page));
  expect(await screen.findByText("SS-1")).toBeVisible();
  expect(screen.getByText("Test company")).toBeVisible();
  expect(screen.getByText("bc_missing")).toBeVisible();
});

it("disables retry while pending and invalidates the list so the reopened row disappears", async () => {
  const retry = deferred<{ shipment_tracking: { id: string } }>();
  fetchMock.mockResolvedValueOnce(page).mockReturnValueOnce(retry.promise)
    .mockResolvedValueOnce({ ...page, shipment_trackings: [], count: 0 });
  const { invalidate } = mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Retry" }));
  expect(screen.getByRole("button", { name: /Retry/ })).toBeDisabled();
  await act(async () => retry.resolve({ shipment_tracking: { id: "shtr_1" } }));
  await waitFor(() => expect(screen.queryByText("SS-1")).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shipment-tracking"] });
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/admin/shipment-tracking/shtr_1/retry", { method: "POST", body: {} });
});

it("shows a toast when retry fails and keeps the row", async () => {
  fetchMock.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error("Retry failed"));
  mount();
  await userEvent.setup().click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Retry failed"));
  expect(screen.getByText("SS-1")).toBeVisible();
});

it("shows a load error instead of an empty success state", async () => {
  fetchMock.mockRejectedValueOnce(new Error("List unavailable"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("List unavailable");
});
