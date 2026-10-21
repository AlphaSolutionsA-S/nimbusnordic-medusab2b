import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CountryLanguages } from "../components/CountryLanguages";
import { translationQueryKey } from "../../../hooks/api/ui-translations";
import { sdk } from "../../../lib/client";
import type { CountryLanguageManagement } from "../../../../types/storefront-translation";

// Mock the SDK boundary only; a small in-memory backend follows the `/admin/country-languages` contract.
jest.mock("../../../lib/client", () => ({ sdk: { client: { fetch: jest.fn() } } }));
const fetchMock = jest.mocked(sdk.client.fetch);

function httpError(status: number, message = "error"): Error {
  return Object.assign(new Error(message), { status });
}

const STALE_MESSAGE = "Country languages were changed by someone else. Reload and try again.";

class FakeCountryBackend {
  version = 3;
  configured = ["de", "dk", "gb"];
  /** `no` is a retained entry: its country left every region but the assignment is kept. */
  assignments: Record<string, string> = { dk: "da", no: "no" };
  /** The original eight plus a ninth canonical tag. */
  active = ["da", "de", "en", "fr", "it", "nl", "no", "pl", "sv"];
  listError: Error | null = null;
  postError: Error | null = null;
  heldPost: Promise<void> | null = null;
  calls: Array<{ method: string; url: string; body?: unknown }> = [];

  management(): CountryLanguageManagement {
    const codes = [...new Set([...this.configured, ...Object.keys(this.assignments)])].sort();
    return {
      version: this.version,
      default_locale: "en",
      countries: codes.map((country_code) => ({
        country_code,
        locale: this.assignments[country_code] ?? "en",
        source: this.assignments[country_code] ? "explicit" : "default",
        configured: this.configured.includes(country_code),
      })),
      active_locales: [...this.active],
    };
  }

  gets() {
    return this.calls.filter((call) => call.method === "GET");
  }

  posts() {
    return this.calls.filter((call) => call.method === "POST");
  }

  handle = async (url: string, init?: { method?: string; body?: { locale: string; expected_version: number } }) => {
    const method = init?.method ?? "GET";
    this.calls.push({ method, url, body: init?.body });
    if (method === "GET" && url === "/admin/country-languages") {
      if (this.listError) {
        throw this.listError;
      }
      return this.management();
    }
    if (method === "POST" && url.startsWith("/admin/country-languages/") && init?.body) {
      if (this.heldPost) {
        await this.heldPost;
      }
      if (this.postError) {
        throw this.postError;
      }
      if (init.body.expected_version !== this.version) {
        throw httpError(409, STALE_MESSAGE);
      }
      this.assignments[decodeURIComponent(url.split("/").pop() ?? "")] = init.body.locale;
      this.version += 1;
      return this.management();
    }
    throw new Error(`Unhandled ${method} ${url}`);
  };
}

let backend: FakeCountryBackend;

beforeEach(() => {
  backend = new FakeCountryBackend();
  fetchMock.mockReset();
  fetchMock.mockImplementation(backend.handle);
});

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // A cached language list stands in for the Translations editor's display query.
  client.setQueryData(translationQueryKey.list(), { locales: [] });
  const view = render(
    <QueryClientProvider client={client}>
      <CountryLanguages />
    </QueryClientProvider>
  );
  return { client, ...view };
}

async function openEdit(countryCode: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Edit language for ${countryCode}` }));
  return screen.findByRole("dialog");
}

async function choose(dialog: HTMLElement, locale: string) {
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole("combobox", { name: "Storefront language" }));
  await user.click(await screen.findByRole("option", { name: locale }));
}

describe("Country languages", () => {
  it("loads on mount and labels default and explicit languages, with retained entries apart", async () => {
    renderView();
    expect(screen.getByRole("status")).toHaveTextContent("Loading country languages");

    const configured = await screen.findByRole("list", { name: "Countries in regions" });
    expect(within(configured).getAllByRole("listitem").map((row) => row.getAttribute("aria-label"))).toEqual([
      "de: en (default)",
      "dk: da (set explicitly)",
      "gb: en (default)",
    ]);
    const retained = screen.getByRole("list", { name: "Retained assignments" });
    expect(within(retained).getAllByRole("listitem").map((row) => row.getAttribute("aria-label"))).toEqual([
      "no: no (set explicitly)",
    ]);
    expect(screen.getByText(/no longer in any region/)).toBeInTheDocument();
    // Retained entries can be reassigned, but there is no control to add a new country.
    expect(screen.getByRole("button", { name: "Edit language for no" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("offers every active language, including a ninth canonical tag", async () => {
    renderView();
    const dialog = await openEdit("gb");
    await userEvent.setup().click(within(dialog).getByRole("combobox", { name: "Storefront language" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(backend.active);
    expect(screen.getByRole("option", { name: "nl" })).toBeInTheDocument();
  });

  it("shows an error with retry, and says when country languages are not set up", async () => {
    backend.listError = httpError(503, "Country languages are not available");
    renderView();
    expect(await screen.findByText(/not set up in this environment/)).toBeInTheDocument();

    backend.listError = httpError(500);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Country languages could not be loaded.")).toBeInTheDocument();

    backend.listError = null;
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("dk: da (set explicitly)")).toBeInTheDocument();
  });

  it("edits a country with the keyboard, posts the displayed version and refreshes lists", async () => {
    const { client } = renderView();
    const user = userEvent.setup();
    const edit = await screen.findByRole("button", { name: "Edit language for dk" });
    edit.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog");

    const select = within(dialog).getByRole("combobox", { name: "Storefront language" });
    select.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    // da is selected; nl is five options further down.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(select).toHaveTextContent("nl");

    within(dialog).getByRole("button", { name: "Save language" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(backend.posts()).toEqual([
      { method: "POST", url: "/admin/country-languages/dk", body: { locale: "nl", expected_version: 3 } },
    ]);
    expect(await screen.findByLabelText("dk: nl (set explicitly)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("dk now uses nl.");
    expect(client.getQueryState(translationQueryKey.list())?.isInvalidated).toBe(true);
    await waitFor(() => expect(backend.gets().length).toBeGreaterThanOrEqual(2));
  });

  it("disables submission while the save is pending", async () => {
    let release: () => void = () => undefined;
    backend.heldPost = new Promise((resolve) => {
      release = resolve;
    });
    renderView();
    const dialog = await openEdit("gb");
    await choose(dialog, "fr");
    const save = within(dialog).getByRole("button", { name: "Save language" });
    await userEvent.setup().click(save);

    await waitFor(() => expect(save).toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.setup().click(save);
    expect(backend.posts()).toHaveLength(1);

    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByLabelText("gb: fr (set explicitly)")).toBeInTheDocument();
  });

  it("keeps the previously saved language displayed when a save fails", async () => {
    backend.postError = httpError(500);
    renderView();
    const dialog = await openEdit("dk");
    await choose(dialog, "sv");
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Save language" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Something went wrong/);
    expect(screen.getByLabelText("dk: da (set explicitly)")).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Storefront language" })).toHaveTextContent("sv");
    expect(within(dialog).getByRole("button", { name: "Save language" })).toBeEnabled();
  });

  it("explains a stale version and saves with the reloaded version", async () => {
    renderView();
    const dialog = await openEdit("dk");
    await choose(dialog, "sv");
    backend.assignments.dk = "de";
    backend.version = 4;
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("button", { name: "Save language" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(STALE_MESSAGE);
    expect(screen.getByLabelText("dk: da (set explicitly)")).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Reload country languages" }));
    expect(await screen.findByLabelText("dk: de (set explicitly)")).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Save language" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(backend.posts().map((call) => call.body)).toEqual([
      { locale: "sv", expected_version: 3 },
      { locale: "sv", expected_version: 4 },
    ]);
    expect(await screen.findByLabelText("dk: sv (set explicitly)")).toBeInTheDocument();
  });
});
