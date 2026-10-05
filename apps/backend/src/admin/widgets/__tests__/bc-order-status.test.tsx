import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { HttpTypes } from "@medusajs/framework/types";
import BcOrderStatusWidget from "../bc-order-status";
import { sdk } from "../../lib/client";
import type { AdminBcIntegration } from "../../../workflows/business-central-order/utils/admin-bc-integration";

jest.mock("../../lib/client", () => ({
  sdk: { client: { fetch: jest.fn() } },
}));
const fetchMock = jest.mocked(sdk.client.fetch);
const order = { id: "order_1" } as HttpTypes.AdminOrder;
function state(patch: Partial<AdminBcIntegration> = {}): {
  bc_integration: AdminBcIntegration;
} {
  return {
    bc_integration: {
      status: "pending",
      bc_order_id: null,
      bc_order_number: null,
      attempt_count: 0,
      initialized_at: "2026-10-01T00:00:00.000Z",
      last_attempt_at: null,
      sent_at: null,
      partial: false,
      failure_reason: null,
      line_failures: [],
      ...patch,
    },
  };
}
function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve: (value: T) => resolve(value) };
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BcOrderStatusWidget data={order} />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  fetchMock.mockReset();
});

describe("Business Central order widget", () => {
  it("waits for status before allowing submission and shows partial line outcomes", async () => {
    const read = deferred<ReturnType<typeof state>>();
    fetchMock.mockReturnValueOnce(read.promise);
    mount();
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Business Central status"
    );
    await act(async () => {
      read.resolve(
        state({
          status: "failed",
          attempt_count: 2,
          last_attempt_at: "2026-10-01T12:00:00.000Z",
          partial: true,
          line_failures: [{ line_number: 7, reason: "not_found" }],
        })
      );
    });
    expect(await screen.findByText("Failed")).toBeVisible();
    expect(screen.getByText("Attempts: 2")).toBeVisible();
    expect(
      screen.getByText(
        `Last updated: ${new Date("2026-10-01T12:00:00.000Z").toLocaleString()}`
      )
    ).toBeVisible();
    expect(screen.getByText(/Line 7: Item not found/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeEnabled();
  });

  it("submits normally, keeps reads manual after acceptance/focus/reconnect, and refreshes the outcome", async () => {
    fetchMock
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce({ message: "accepted" })
      .mockResolvedValueOnce(
        state({ status: "sent", bc_order_id: "bc_new", attempt_count: 1 })
      );
    mount();
    const user = userEvent.setup();
    await screen.findByText("Pending");
    await user.click(screen.getByRole("button", { name: "Write to BC" }));
    await screen.findByText(
      /Submission accepted\. Use Refresh to check the outcome/
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/admin/orders/order_1/bc-integration/submit",
      { method: "POST", body: { force_resend: false } }
    );
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("bc_new")).toBeVisible();
    expect(screen.getByText("Sent")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("requires explicit force confirmation with the BC id and cancellation sends nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(
        state({ status: "sent", bc_order_id: "bc_existing" })
      )
      .mockResolvedValueOnce({ message: "accepted" });
    mount();
    const user = userEvent.setup();
    await screen.findByText("Sent");
    await user.click(screen.getByRole("button", { name: "Write to BC" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "This order has already been sent to Business Central."
    );
    expect(dialog).toHaveTextContent("Current BC order: bc_existing");
    expect(dialog).toHaveTextContent(
      "Continuing may create another order in Business Central."
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Write to BC" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Force resend",
      })
    );
    await screen.findByText(/Submission accepted/);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin/orders/order_1/bc-integration/submit",
      { method: "POST", body: { force_resend: true } }
    );
  });

  it.each([
    { status: "failed" as const, bc_order_id: "bc_header" },
    { status: "sent" as const, bc_order_id: null },
  ])(
    "requires confirmation when sent or a BC header exists: %j",
    async (patch) => {
      fetchMock.mockResolvedValueOnce(state(patch));
      mount();
      const user = userEvent.setup();
      await screen.findByText(patch.status === "sent" ? "Sent" : "Failed");
      await user.click(screen.getByRole("button", { name: "Write to BC" }));
      expect(await screen.findByRole("alertdialog")).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("shows an untracked order with a clear missing identifier", async () => {
    fetchMock.mockResolvedValueOnce(state({ status: null }));
    mount();
    expect(await screen.findByText("Not tracked")).toBeVisible();
    expect(screen.getByText("Not yet sent")).toBeVisible();
  });

  it("blocks submission on a failed status read and permits recovery only after manual refresh", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("secret token stack trace"))
      .mockResolvedValueOnce(state());
    mount();
    const user = userEvent.setup();
    await screen.findByText(
      "Could not load Business Central status. Use Refresh to try again."
    );
    expect(screen.queryByText(/secret token/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText("Pending");
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeEnabled();
  });

  it("disables both actions during submission and sanitizes a start failure", async () => {
    const start = deferred<{ message: string }>();
    fetchMock.mockResolvedValueOnce(state()).mockReturnValueOnce(start.promise);
    mount();
    const user = userEvent.setup();
    await screen.findByText("Pending");
    await user.click(screen.getByRole("button", { name: "Write to BC" }));
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    await act(async () => {
      start.resolve({ message: "accepted" });
    });
    await screen.findByText(/Submission accepted/);
    fetchMock.mockRejectedValueOnce(new Error("private vendor error"));
    await user.click(screen.getByRole("button", { name: "Write to BC" }));
    await screen.findByText(
      "Could not start the Business Central submission. Try again."
    );
    expect(screen.queryByText(/private vendor error/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write to BC" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });
});
