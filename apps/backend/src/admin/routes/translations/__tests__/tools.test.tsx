import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TranslationsWorkspace } from "../components/TranslationsWorkspace";
import { sdk } from "../../../lib/client";
import { translationQueryKey } from "../../../hooks/api/ui-translations";
import { diffMessages, mergeMessages } from "../../../../utils/translations/documents";
import type {
  IcuWarning,
  MessageDocument,
  MissingKeyRecord,
  TranslationDocument,
} from "../../../../types/storefront-translation";

// Mock the SDK boundary only; a small in-memory backend follows the HTTP contract.
jest.mock("../../../lib/client", () => ({ sdk: { client: { fetch: jest.fn() } } }));
const fetchMock = sdk.client.fetch as unknown as jest.Mock;

const NOW = "2026-09-30T10:00:00.000Z";

function httpError(status: number, message = "error"): Error {
  return Object.assign(new Error(message), { status });
}

type Body = Record<string, unknown>;

class FakeBackend {
  documents: Record<string, TranslationDocument> = {};
  missing: MissingKeyRecord[] = [];
  calls: Array<{ method: string; url: string; body?: Body }> = [];
  previewWarnings: IcuWarning[] = [];

  put(locale: string, messages: MessageDocument, version = 1, is_active = true): TranslationDocument {
    const document = { id: `sftr_${locale}`, locale, version, is_active, updated_at: NOW, messages };
    this.documents[locale] = document;
    return document;
  }

  posts(pattern: RegExp) {
    return this.calls.filter((call) => call.method === "POST" && pattern.test(call.url));
  }

  private mutation(document: TranslationDocument) {
    return { translation: document, warnings: [], refresh: document.is_active ? "deferred" : "not_needed" };
  }

  handle = async (url: string, init?: { method?: string; body?: Body }) => {
    const method = init?.method ?? "GET";
    this.calls.push({ method, url, body: init?.body });
    const path = url.split("?")[0];
    const [, , , rawLocale, action, id, subAction] = path.split("/");
    const locale = rawLocale ? decodeURIComponent(rawLocale) : undefined;
    const current = locale ? this.documents[locale] : undefined;
    const body = init?.body ?? {};

    if (method === "GET" && path === "/admin/ui-translations") {
      return {
        locales: Object.values(this.documents).map(({ messages: _m, ...summary }) => summary),
      };
    }
    if (method === "GET" && locale === "missing-keys") {
      const params = new URLSearchParams(url.split("?")[1]);
      const filter = params.get("locale");
      const offset = Number(params.get("offset") ?? 0);
      const limit = Number(params.get("limit") ?? 20);
      const rows = this.missing.filter((row) => !row.dismissed && (!filter || row.locale === filter));
      return { missing_keys: rows.slice(offset, offset + limit), count: rows.length, offset, limit };
    }
    if (method === "GET" && locale && !action) {
      if (!current) {
        throw httpError(404);
      }
      return { translation: current };
    }
    if (method === "POST" && path === "/admin/ui-translations") {
      const messages = (body.source === "copy"
        ? this.documents[body.source_locale as string].messages
        : body.messages) as MessageDocument;
      return this.mutation(this.put(body.locale as string, messages, 1, false));
    }
    if (method === "POST" && locale && (action === "import-preview" || action === "import")) {
      const expected = body.expected_version as number | null;
      if ((expected === null && current) || (expected !== null && current?.version !== expected)) {
        throw httpError(409);
      }
      const incoming = body.messages as MessageDocument;
      const next = current && body.mode === "merge" ? mergeMessages(current.messages, incoming) : incoming;
      const diff = diffMessages(current?.messages ?? {}, next);
      if (action === "import-preview") {
        return { locale, expected_version: expected, mode: body.mode, diff, warnings: this.previewWarnings };
      }
      if (diff.removed.length && !body.confirm_removed) {
        throw httpError(400, "Confirm the removal");
      }
      return this.mutation(this.put(locale, next, (current?.version ?? 0) + 1, current?.is_active ?? false));
    }
    if (method === "POST" && locale && action === "activation" && current) {
      if (current.version !== body.expected_version) {
        throw httpError(409);
      }
      return this.mutation(this.put(locale, current.messages, current.version + 1, body.is_active as boolean));
    }
    if (method === "POST" && locale && action === "missing-keys" && current) {
      const record = this.missing.find((row) => row.id === id && row.locale === locale);
      if (!record) {
        throw httpError(404);
      }
      if (subAction === "dismiss") {
        record.dismissed = true;
        return { dismissed: true };
      }
      this.missing = this.missing.filter((row) => row !== record);
      const next = mergeMessages(current.messages, { [record.key.split(".")[0]]: { [record.key.split(".")[1]]: body.value as string } });
      return this.mutation(this.put(locale, next, current.version + 1, current.is_active));
    }
    throw new Error(`Unhandled ${method} ${url}`);
  };
}

const english: MessageDocument = {
  Common: { title: "Welcome {name}", empty: "" },
  Cart: { title: "Your cart", note: "Note" },
};

let backend: FakeBackend;

beforeEach(() => {
  backend = new FakeBackend();
  fetchMock.mockReset();
  fetchMock.mockImplementation(backend.handle);
});

function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: "*", element: <TranslationsWorkspace /> }]);
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { client, ...view };
}

function jsonFile(messages: unknown, name = "texts.json"): File {
  return new File([JSON.stringify(messages)], name, { type: "application/json" });
}

async function confirmPrompt(buttonName: string) {
  const dialog = await screen.findByRole("alertdialog");
  await userEvent.setup().click(within(dialog).getByRole("button", { name: buttonName }));
}

async function openImportDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Import or compare file" }));
  return screen.findByRole("dialog");
}

describe("Translation tools", () => {
  it("TC-1: imports a first language with no English row, creates it inactive, selects and activates it", async () => {
    renderWorkspace();
    const user = userEvent.setup();
    expect(await screen.findByText("No languages have been imported yet.")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Import da" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Applying creates it as an inactive language/)).toBeInTheDocument();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile(english, "da.json"));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    expect(await within(dialog).findByText(/4 added · 0 changed · 0 removed · 1 empty/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Create language" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(backend.documents.da).toMatchObject({ version: 1, is_active: false });
    expect(await screen.findByDisplayValue("Welcome {name}")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(backend.posts(/import$/)[0].body).toMatchObject({ expected_version: null, mode: "replace" });

    await user.click(screen.getByRole("button", { name: "Activate" }));
    await confirmPrompt("Activate");
    await waitFor(() => expect(backend.documents.da).toMatchObject({ version: 2, is_active: true }));
    expect(backend.posts(/activation$/)[0].body).toEqual({ expected_version: 1, is_active: true });
    expect(await screen.findByLabelText("da: Imported, active")).toBeInTheDocument();
  });

  it("TC-2: replace with removals requires unchecked-by-default confirmation; changes reset it; close writes nothing", async () => {
    backend.put("en", english);
    renderWorkspace();
    const user = userEvent.setup();
    const dialog = await openImportDialog();

    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Cart: { title: "Basket" } }));
    await user.click(within(dialog).getByLabelText(/Replace: the file becomes/));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    const removed = await within(dialog).findByRole("list", { name: "Removed texts" });
    expect(within(removed).getAllByRole("listitem")).toHaveLength(3);
    const apply = within(dialog).getByRole("button", { name: "Apply import" });
    const confirm = within(dialog).getByRole("checkbox");
    expect(confirm).not.toBeChecked();
    expect(apply).toBeDisabled();
    await user.click(confirm);
    expect(apply).toBeEnabled();

    await user.click(within(dialog).getByLabelText(/Merge: keep existing/));
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(apply).toBeDisabled();

    await user.click(within(dialog).getByLabelText(/Replace: the file becomes/));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    expect(await within(dialog).findByRole("checkbox")).not.toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Close without applying" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(backend.posts(/\/import$/)).toHaveLength(0);
    expect(backend.documents.en.version).toBe(1);
  });

  it("TC-3: a concurrent change makes apply fail with 409 while keeping the file", async () => {
    backend.put("en", english);
    renderWorkspace();
    const user = userEvent.setup();
    const dialog = await openImportDialog();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Cart: { title: "Basket" } }));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    await within(dialog).findByText(/0 added · 1 changed/);

    backend.put("en", english, 2);
    await user.click(within(dialog).getByRole("button", { name: "Apply import" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/changed after the preview/);
    expect(within(dialog).getByText("texts.json")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Preview changes" })).toBeEnabled();
    expect(backend.documents.en.version).toBe(2);
  });

  it("applies with the previewed version even after the editor picked up a newer one", async () => {
    backend.put("en", english);
    const { client } = renderWorkspace();
    const user = userEvent.setup();
    const dialog = await openImportDialog();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Cart: { title: "Basket" } }));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    await within(dialog).findByText(/0 added · 1 changed/);

    backend.put("en", { ...english, Cart: { title: "Your cart", note: "Theirs" } }, 2);
    await client.refetchQueries({ queryKey: translationQueryKey.all });
    await user.click(within(dialog).getByRole("button", { name: "Apply import" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/changed after the preview/);
    expect(backend.posts(/\/import$/)[0].body).toMatchObject({ expected_version: 1 });
    expect(backend.documents.en.messages).toMatchObject({ Cart: { title: "Your cart", note: "Theirs" } });
  });

  it("lists every preview warning when one key has several", async () => {
    backend.put("en", english);
    backend.previewWarnings = [
      { key: "Common.title", code: "arguments", message: "Placeholders differ from reference: missing {name}" },
      { key: "Common.title", code: "structure", message: "Rich-text tags differ from reference (expected <b>)" },
    ];
    const consoleError = jest.spyOn(console, "error");
    renderWorkspace();
    const user = userEvent.setup();
    const dialog = await openImportDialog();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Common: { title: "Hi" } }));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));

    const list = await within(dialog).findByRole("list", { name: "Placeholder warnings" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Common.title: Placeholders differ from reference: missing {name}",
      "Common.title: Rich-text tags differ from reference (expected <b>)",
    ]);
    const duplicateKeyErrors = consoleError.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("same key"))
    );
    expect(duplicateKeyErrors).toEqual([]);
    consoleError.mockRestore();
  });

  it("TC-3: a successful merge import adopts the new version", async () => {
    backend.put("en", english);
    renderWorkspace();
    const user = userEvent.setup();
    const dialog = await openImportDialog();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Common: { title: "Hi {name}" } }));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    await within(dialog).findByText(/0 added · 1 changed/);
    await user.click(within(dialog).getByRole("button", { name: "Apply import" }));
    expect(await screen.findByDisplayValue("Hi {name}")).toBeInTheDocument();
    expect(backend.documents.en.version).toBe(2);

    const input = screen.getByDisplayValue("Hi {name}");
    await user.type(input, "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(backend.posts(/\/admin\/ui-translations\/en$/)[0]?.body).toMatchObject({ expected_version: 2 }));
  });

  it("TC-4: compares with another reference language and exports saved content exactly", async () => {
    const danish = { Common: { title: "Velkommen {name}", empty: " " }, Cart: { title: "Kurv – æøå 🛒" } };
    backend.put("en", english);
    backend.put("da", danish);
    backend.put("sv", { Common: { title: "Välkommen {name}" }, Cart: { title: "", extra: "x" } });
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: jest.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:test";
      }),
      revokeObjectURL: jest.fn(),
    });
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderWorkspace();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "da" }));
    await screen.findByDisplayValue("Velkommen {name}");
    await user.click(screen.getByRole("button", { name: "Compare languages" }));
    const dialog = await screen.findByRole("dialog");
    const list = await within(dialog).findByRole("list", { name: "Missing or empty texts" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Cart.note"),
      expect.stringContaining("Common.empty"),
    ]);

    await user.click(within(dialog).getByRole("combobox", { name: "Reference language" }));
    await user.click(await screen.findByRole("option", { name: "sv" }));
    const svList = await within(dialog).findByRole("list", { name: "Missing or empty texts" });
    expect(within(svList).getAllByRole("listitem")).toHaveLength(1);
    expect(svList).toHaveTextContent("Cart.extra");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Export saved da" }));
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    expect(JSON.parse(text)).toEqual(danish);
    expect(text.endsWith("\n")).toBe(true);
    click.mockRestore();
  });

  it("TC-5: fills and dismisses missing keys through locale-scoped endpoints; outages cannot be filled", async () => {
    backend.put("en", english);
    backend.missing = [
      { id: "trmk_1", locale: "en", key: "Cart.added", count: 3, first_seen_at: NOW, last_seen_at: NOW, last_page_path: "/gb/cart", dismissed: false },
      { id: "trmk_2", locale: "en", key: "__locale_unavailable__", count: 1, first_seen_at: NOW, last_seen_at: NOW, last_page_path: "/", dismissed: false },
      { id: "trmk_3", locale: "en", key: "Cart.other", count: 1, first_seen_at: NOW, last_seen_at: NOW, last_page_path: "/", dismissed: false },
    ];
    renderWorkspace();
    const user = userEvent.setup();
    await screen.findByDisplayValue("Welcome {name}");
    await user.click(screen.getByRole("button", { name: "Missing texts" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Language unavailable on the storefront")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Text for __locale_unavailable__")).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Text for Cart.added"), "Added text");
    await user.click(within(dialog).getAllByRole("button", { name: "Add text" })[0]);
    await waitFor(() => expect(backend.posts(/resolve$/)).toHaveLength(1));
    expect(backend.posts(/resolve$/)[0]).toMatchObject({
      url: "/admin/ui-translations/en/missing-keys/trmk_1/resolve",
      body: { expected_version: 1, value: "Added text" },
    });
    await waitFor(() => expect(within(dialog).queryByText("Cart.added")).not.toBeInTheDocument());

    const otherRow = within(dialog).getByText("Cart.other").closest("tr") as HTMLElement;
    await user.click(within(otherRow).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(within(dialog).queryByText("Cart.other")).not.toBeInTheDocument());
    expect(backend.posts(/dismiss$/)[0].url).toBe("/admin/ui-translations/en/missing-keys/trmk_3/dismiss");
  });

  it("TC-6: asks before discarding dirty work when switching language or adopting an import", async () => {
    backend.put("en", english);
    backend.put("da", english);
    renderWorkspace();
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /Common\.title/ });
    await user.clear(input);
    await user.type(input, "Unsaved");

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "da" }));
    await confirmPrompt("Keep editing");
    expect(screen.getByRole("textbox", { name: /Common\.title/ })).toHaveValue("Unsaved");

    const dialog = await openImportDialog();
    await user.upload(within(dialog).getByLabelText("JSON file"), jsonFile({ Cart: { title: "Imported" } }));
    await user.click(within(dialog).getByRole("button", { name: "Preview changes" }));
    await within(dialog).findByText(/1 changed/);
    await user.click(within(dialog).getByRole("button", { name: "Apply import" }));
    await confirmPrompt("Keep editing");
    expect(await screen.findByText(/Your unsaved edits are kept/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Common\.title/ })).toHaveValue("Unsaved");
    expect(backend.documents.en.version).toBe(2);
  });

  it("missing texts restart at the first page on a new filter and step back from an emptied page", async () => {
    backend.put("en", english);
    const record = (locale: string, index: number): MissingKeyRecord => ({
      id: `trmk_${locale}_${index}`,
      locale,
      key: `Cart.k${String(index).padStart(2, "0")}`,
      count: 1,
      first_seen_at: NOW,
      last_seen_at: NOW,
      last_page_path: "/",
      dismissed: false,
    });
    backend.missing = [
      ...Array.from({ length: 21 }, (_, index) => record("en", index)),
      record("da", 0),
      record("da", 1),
    ];
    renderWorkspace();
    const user = userEvent.setup();
    await screen.findByDisplayValue("Welcome {name}");
    await user.click(screen.getByRole("button", { name: "Missing texts" }));
    const dialog = await screen.findByRole("dialog");

    // All languages are shown first because the dialog's filter defaults before the language loads.
    expect(await within(dialog).findByText("1–20 of 23")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(await within(dialog).findByText("21–23 of 23")).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Show all languages"));
    expect(await within(dialog).findByText("1–20 of 21")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(await within(dialog).findByText("21–21 of 21")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(await within(dialog).findByText("1–20 of 20")).toBeInTheDocument();
    expect(within(dialog).queryByText("No missing texts have been reported.")).not.toBeInTheDocument();
  });

  it.each([
    ["zero", [] as string[], [] as string[]],
    ["some", ["da", "en"], ["en"]],
    ["all", ["da", "de", "en", "fr", "it", "no", "pl", "sv"], ["da", "de", "en", "fr", "it", "no", "pl", "sv"]],
  ])("TC-7: readiness with %s original locales", async (_name, imported, active) => {
    for (const locale of imported) {
      backend.put(locale, english, 1, active.includes(locale));
    }
    renderWorkspace();
    expect(screen.getByLabelText("da: Checking…")).toBeInTheDocument();
    for (const locale of ["da", "de", "en", "fr", "it", "no", "pl", "sv"]) {
      const expected = !imported.includes(locale)
        ? "Missing"
        : active.includes(locale)
          ? "Imported, active"
          : "Imported, inactive";
      expect(await screen.findByLabelText(`${locale}: ${expected}`)).toBeInTheDocument();
    }
    if (!imported.includes("fr")) {
      await userEvent.setup().click(screen.getByRole("button", { name: "Import fr" }));
      expect(await screen.findByRole("heading", { name: "Import or compare a file for fr" })).toBeInTheDocument();
    }
  });
});
