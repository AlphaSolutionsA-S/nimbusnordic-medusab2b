import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import type {
  CreateInput,
  LocaleSummary,
  MessageDocument,
  MissingKeyRecord,
  MutationResponse,
  PreviewResponse,
  TranslationDocument,
} from "../../../types/storefront-translation";

export const translationKeys = {
  all: ["ui-translations"] as const,
  list: () => ["ui-translations", "list"] as const,
  detail: (locale: string) => ["ui-translations", "locale", locale] as const,
  missing: (locale?: string) => ["ui-translations", "missing", locale ?? "all"] as const,
};

function localePath(locale: string): string {
  return `/admin/ui-translations/${encodeURIComponent(locale)}`;
}

export function useTranslationLocales() {
  return useQuery({
    queryKey: translationKeys.list(),
    queryFn: () => sdk.client.fetch<{ locales: LocaleSummary[] }>("/admin/ui-translations"),
  });
}

export function useTranslation(locale: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: translationKeys.detail(locale),
    enabled: Boolean(locale) && (options.enabled ?? true),
    queryFn: () => sdk.client.fetch<{ translation: TranslationDocument }>(localePath(locale)),
  });
}

/** Seeds the detail cache with the committed document so a stale cached version never replaces it. */
export function useAdoptMutation() {
  const client = useQueryClient();
  return async (result: MutationResponse): Promise<void> => {
    client.setQueryData(translationKeys.detail(result.translation.locale), {
      translation: result.translation,
    });
    await client.invalidateQueries({ queryKey: translationKeys.all });
  };
}

export function useSaveTranslation(locale: string) {
  const adopt = useAdoptMutation();
  return useMutation({
    mutationFn: (body: { expected_version: number; messages: MessageDocument }) =>
      sdk.client.fetch<MutationResponse>(localePath(locale), { method: "POST", body }),
    onSuccess: adopt,
  });
}

type ImportBody = {
  expected_version: number | null;
  mode: "merge" | "replace";
  messages: MessageDocument;
};

/** Read-only server preview; never invalidates or persists anything. */
export function usePreviewImport(locale: string) {
  return useMutation({
    mutationFn: (body: ImportBody) =>
      sdk.client.fetch<PreviewResponse>(`${localePath(locale)}/import-preview`, {
        method: "POST",
        body,
      }),
  });
}

export function useImportTranslation(locale: string) {
  const adopt = useAdoptMutation();
  return useMutation({
    mutationFn: (body: ImportBody & { confirm_removed: boolean }) =>
      sdk.client.fetch<MutationResponse>(`${localePath(locale)}/import`, { method: "POST", body }),
    onSuccess: adopt,
  });
}

export function useCreateTranslation() {
  const adopt = useAdoptMutation();
  return useMutation({
    mutationFn: (body: CreateInput) =>
      sdk.client.fetch<MutationResponse>("/admin/ui-translations", { method: "POST", body }),
    onSuccess: adopt,
  });
}

export function useActivateTranslation(locale: string) {
  const adopt = useAdoptMutation();
  return useMutation({
    mutationFn: (body: { expected_version: number; is_active: boolean }) =>
      sdk.client.fetch<MutationResponse>(`${localePath(locale)}/activation`, { method: "POST", body }),
    onSuccess: adopt,
  });
}

export const MISSING_PAGE_SIZE = 20;

export function useMissingTranslations(locale: string | undefined, offset: number) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(MISSING_PAGE_SIZE) });
  if (locale) {
    params.set("locale", locale);
  }
  return useQuery({
    queryKey: [...translationKeys.missing(locale), offset],
    queryFn: () =>
      sdk.client.fetch<{ missing_keys: MissingKeyRecord[]; count: number; offset: number; limit: number }>(
        `/admin/ui-translations/missing-keys?${params.toString()}`
      ),
  });
}

export function useResolveMissing(locale: string) {
  const adopt = useAdoptMutation();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; expected_version: number; value: string }) =>
      sdk.client.fetch<MutationResponse>(
        `${localePath(locale)}/missing-keys/${encodeURIComponent(id)}/resolve`,
        { method: "POST", body }
      ),
    onSuccess: adopt,
  });
}

export function useDismissMissing(locale: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ dismissed: true }>(
        `${localePath(locale)}/missing-keys/${encodeURIComponent(id)}/dismiss`,
        { method: "POST", body: {} }
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: translationKeys.all }),
  });
}
