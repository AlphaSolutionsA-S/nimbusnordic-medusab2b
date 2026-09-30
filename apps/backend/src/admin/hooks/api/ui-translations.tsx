import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import type {
  LocaleSummary,
  MessageDocument,
  MutationResponse,
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
