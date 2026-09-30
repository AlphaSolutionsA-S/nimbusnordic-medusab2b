import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TranslationEditor } from "../components/TranslationEditor";
import { translationQueryKey } from "../../../hooks/api/ui-translations";
import { sdk } from "../../../lib/client";
import type { LocaleSummary, TranslationDocument } from "../../../../types/storefront-translation";

// Mock the SDK boundary only; the editor, hooks and React Query run for real.
jest.mock("../../../lib/client", () => ({ sdk: { client: { fetch: jest.fn() } } }));
const fetchMock = sdk.client.fetch as unknown as jest.Mock;

const NOW = "2026-09-30T10:00:00.000Z";

function doc(locale: string, version: number, messages: TranslationDocument["messages"], is_active = true): TranslationDocument {
  return { id: `sftr_${locale}`, locale, version, is_active, updated_at: NOW, messages };
}
function summary({ messages: _messages, ...rest }: TranslationDocument): LocaleSummary {
  return rest;
}
function httpError(status: number, message = "error"): Error {
  return Object.assign(new Error(message), { status });
}

interface Backend {
  documents: Record<string, TranslationDocument>;
  onPost?: (url: string, body: unknown) => unknown;
  listError?: boolean;
  detailError?: boolean;
}

function installBackend(backend: Backend) {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === "POST") {
      return backend.onPost?.(url, init.body);
    }
    if (url === "/admin/ui-translations") {
      if (backend.listError) {
        throw httpError(500);
      }
      return { locales: Object.values(backend.documents).map(summary) };
    }
    if (backend.detailError) {
      throw httpError(500);
    }
    const locale = decodeURIComponent(url.split("/").pop() ?? "");
    const translation = backend.documents[locale];
    if (!translation) {
      throw httpError(404, "not found");
    }
    return { translation };
  });
}

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // The editor blocks in-app navigation with unsaved work, which needs a data router.
  const router = createMemoryRouter([{ path: "*", element: <TranslationEditor /> }]);
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { client, ...view };
}

const english = {
  Common: { title: "Welcome {name}", notFound: { headingLabel: "Page not found" } },
  Cart: { title: "Your cart", hiddenNeedle: "Findable basket text" },
};

async function field(name: RegExp) {
  return screen.findByRole("textbox", { name });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("TranslationEditor", () => {
  it("TC-1: saves with the captured version and the complete document, then adopts the result", async () => {
    const posts: Array<{ url: string; body: unknown }> = [];
    const backend: Backend = { documents: { en: doc("en", 1, english) } };
    backend.onPost = (url, body) => {
      posts.push({ url, body });
      const saved = doc("en", 2, (body as { messages: TranslationDocument["messages"] }).messages);
      backend.documents.en = saved;
      return { translation: saved, warnings: [], refresh: "deferred" };
    };
    installBackend(backend);
    renderEditor();
    const user = userEvent.setup();

    const input = await field(/Common\.title/);
    await user.clear(input);
    await user.type(input, "Hello {{name}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText(/Saved\. The storefront picks up/);
    expect(posts).toEqual([
      {
        url: "/admin/ui-translations/en",
        body: {
          expected_version: 1,
          messages: { ...english, Common: { ...english.Common, title: "Hello {name}" } },
        },
      },
    ]);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(await field(/Common\.title/)).toHaveValue("Hello {name}");
  });

  it("TC-2: keeps typed values after a 409 and discards only on explicit reload", async () => {
    const backend: Backend = { documents: { en: doc("en", 1, english) } };
    backend.onPost = () => {
      backend.documents.en = doc("en", 2, { ...english, Cart: { ...english.Cart, title: "Theirs" } });
      throw httpError(409, "conflict");
    };
    installBackend(backend);
    renderEditor();
    const user = userEvent.setup();

    const input = await field(/Common\.title/);
    await user.clear(input);
    await user.type(input, "Mine");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Someone else saved this language");
    expect(await field(/Common\.title/)).toHaveValue("Mine");

    await user.click(within(alert).getByRole("button", { name: /Reload latest/ }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(await field(/Common\.title/)).toHaveValue("Welcome {name}");
  });

  it("TC-2: a reference-language refetch does not reset the draft", async () => {
    installBackend({
      documents: {
        en: doc("en", 1, english),
        da: doc("da", 3, { ...english, Common: { ...english.Common, title: "Velkommen {name}" } }, false),
      },
    });
    const { client } = renderEditor();
    const user = userEvent.setup();

    await field(/Common\.title/);
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "da (inactive)" }));
    const input = await screen.findByDisplayValue("Velkommen {name}");
    await user.clear(input);
    await user.type(input, "Draft text");
    await client.invalidateQueries({ queryKey: translationQueryKey.detail("en") });
    await client.refetchQueries({ queryKey: translationQueryKey.detail("da") });
    expect(await field(/Common\.title/)).toHaveValue("Draft text");
  });

  it("TC-3: search finds texts in hidden sections by value and key, without rename or delete controls", async () => {
    installBackend({ documents: { en: doc("en", 1, english) } });
    renderEditor();
    const user = userEvent.setup();

    await field(/Common\.title/);
    expect(screen.queryByRole("textbox", { name: /Cart\.hiddenNeedle/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox"), "findable basket");
    expect(await field(/Hidden needle \(Cart\.hiddenNeedle\)/)).toHaveValue("Findable basket text");
    expect(screen.getByText("1 matching text")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "notFound.heading");
    expect(await field(/Heading label \(Common\.notFound\.headingLabel\)/)).toBeInTheDocument();
    expect(screen.getByText("Common › Not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rename|delete|remove/i })).not.toBeInTheDocument();
  });

  it("TC-3: switches sections through tabs, rendering one section at a time", async () => {
    installBackend({ documents: { en: doc("en", 1, english) } });
    renderEditor();
    const user = userEvent.setup();
    await field(/Common\.title/);
    await user.click(screen.getByRole("tab", { name: "Cart" }));
    expect(await field(/Cart\.title/)).toHaveValue("Your cart");
    expect(screen.queryByRole("textbox", { name: /Common\.title/ })).not.toBeInTheDocument();
  });

  it("TC-4: shows the empty state", async () => {
    installBackend({ documents: {} });
    renderEditor();
    expect(await screen.findByText("No languages have been imported yet.")).toBeInTheDocument();
  });

  it("TC-4: shows loading, then an error with retry", async () => {
    const backend: Backend = { documents: { en: doc("en", 1, english) }, listError: true };
    installBackend(backend);
    renderEditor();
    expect(screen.getByRole("status")).toHaveTextContent("Loading languages");
    const retry = await screen.findByRole("button", { name: "Retry" });
    backend.listError = false;
    await userEvent.setup().click(retry);
    expect(await field(/Common\.title/)).toBeInTheDocument();
  });

  it("TC-5: shows ICU warnings without blocking save, and renders HTML-like text literally", async () => {
    const markup = '<img src=x onerror="alert(1)">';
    installBackend({
      documents: {
        en: doc("en", 1, english),
        da: doc("da", 1, { ...english, Cart: { ...english.Cart, title: markup } }),
      },
    });
    const { container } = renderEditor();
    const user = userEvent.setup();
    await field(/Common\.title/);
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "da" }));

    const input = await screen.findByDisplayValue("Welcome {name}");
    await user.clear(input);
    await user.type(input, "Velkommen");
    expect(await screen.findByText(/Placeholders differ from reference: missing \{name\}/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await user.click(screen.getByRole("tab", { name: "Cart" }));
    expect(await field(/Cart\.title/)).toHaveValue(markup);
    expect(container.querySelector("img")).toBeNull();
  });

  it("TC-6: keeps empty nested groups in the submitted document", async () => {
    const withEmpty = { Common: { title: "Hi", empty: {} }, Layout: {} };
    const posts: unknown[] = [];
    installBackend({
      documents: { en: doc("en", 4, withEmpty) },
      onPost: (_url, body) => {
        posts.push(body);
        return { translation: doc("en", 5, (body as { messages: typeof withEmpty }).messages), warnings: [], refresh: "not_needed" };
      },
    });
    renderEditor();
    const user = userEvent.setup();
    const input = await field(/Common\.title/);
    await user.type(input, "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved.");
    expect(posts).toEqual([{ expected_version: 4, messages: { Common: { title: "Hi!", empty: {} }, Layout: {} } }]);
  });

  it("keeps text typed while a save is in flight and rebases it on the saved version", async () => {
    const posts: unknown[] = [];
    let finishSave: () => void = () => undefined;
    const backend: Backend = { documents: { en: doc("en", 1, english) } };
    backend.onPost = (_url, body) => {
      posts.push(body);
      const saved = doc("en", posts.length + 1, (body as { messages: TranslationDocument["messages"] }).messages);
      return new Promise((resolve) => {
        finishSave = () => {
          backend.documents.en = saved;
          resolve({ translation: saved, warnings: [], refresh: "not_needed" });
        };
      });
    };
    installBackend(backend);
    renderEditor();
    const user = userEvent.setup();

    const input = await field(/Common\.title/);
    await user.clear(input);
    await user.type(input, "Hello");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    await user.type(input, " again");
    finishSave();

    await screen.findByText("Saved.");
    expect(await field(/Common\.title/)).toHaveValue("Hello again");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toMatchObject({
      expected_version: 2,
      messages: { Common: { title: "Hello again" } },
    });
  });

  it("keeps the draft and the conflict when reloading after a 409 fails", async () => {
    const backend: Backend = { documents: { en: doc("en", 1, english) } };
    backend.onPost = () => {
      throw httpError(409, "conflict");
    };
    installBackend(backend);
    renderEditor();
    const user = userEvent.setup();

    const input = await field(/Common\.title/);
    await user.clear(input);
    await user.type(input, "Mine");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const conflict = await screen.findByRole("alert");

    backend.detailError = true;
    await user.click(within(conflict).getByRole("button", { name: /Reload latest/ }));
    expect(await screen.findByText(/latest version could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText("Someone else saved this language")).toBeInTheDocument();
    expect(await field(/Common\.title/)).toHaveValue("Mine");
  });
});
