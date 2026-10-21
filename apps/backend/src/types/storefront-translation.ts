export interface MessageDocument {
  [segment: string]: string | MessageDocument;
}
export interface LocaleSummary {
  id: string;
  locale: string;
  version: number;
  is_active: boolean;
  updated_at: string;
}
export interface TranslationDocument extends LocaleSummary {
  messages: MessageDocument;
}
export interface IcuWarning {
  key: string;
  code: "invalid_icu" | "arguments" | "structure" | "reference_unavailable";
  message: string;
}
export interface DocumentDiff {
  added: string[];
  changed: string[];
  removed: string[];
  empty: string[];
}
export interface ImportInput {
  locale: string;
  expected_version: number | null;
  mode: "merge" | "replace";
  messages: MessageDocument;
  confirm_removed: boolean;
}
export type CreateInput = {
  locale: string;
} & (
  | { source: "copy"; source_locale: string; source_version: number }
  | { source: "import"; messages: MessageDocument }
);
export type MutationInput =
  | { operation: "create"; input: CreateInput }
  | { operation: "save"; locale: string; expected_version: number; messages: MessageDocument }
  | { operation: "import"; input: ImportInput }
  | { operation: "activate"; locale: string; expected_version: number; is_active: boolean }
  | {
      operation: "resolve";
      locale: string;
      expected_version: number;
      missing_id: string;
      value: string;
    };
export interface MutationResult {
  translation: TranslationDocument;
  warnings: IcuWarning[];
}
export interface MutationResponse extends MutationResult {
  refresh: "not_needed" | "requested" | "deferred";
}
export interface PreviewResponse {
  locale: string;
  expected_version: number | null;
  mode: "merge" | "replace";
  diff: DocumentDiff;
  warnings: IcuWarning[];
}
export type MissingReport = {
  locale: string;
  page_path: string;
} & ({ kind: "key"; key: string } | { kind: "locale_unavailable" });
export interface MissingKeyRecord {
  id: string;
  locale: string;
  key: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_page_path: string;
  dismissed: boolean;
}
/** Lowercase ISO 3166-1 alpha-2 country code → canonical locale; absent keys mean the default. */
export type CountryLanguageAssignments = Record<string, string>;
export interface CountryLanguageConfiguration {
  assignments: CountryLanguageAssignments;
  version: number;
}
export interface CountryLanguageAssignmentInput {
  country_code: string;
  locale: string;
  expected_version: number;
  /** Current Region country codes; a new key is only created for one of these. */
  configured_country_codes: string[];
}
export interface CountryLanguageBootstrapResult {
  created: boolean;
  configuration: CountryLanguageConfiguration;
}
export interface CountryLanguageBootstrapReport {
  initialized: boolean;
  unavailable_locales: string[];
}
export interface CountryLanguageEntry {
  country_code: string;
  locale: string;
  source: "explicit" | "default";
}
export interface CountryLanguageManagementEntry extends CountryLanguageEntry {
  configured: boolean;
}
export interface CountryLanguageManagement {
  version: number;
  default_locale: string;
  countries: CountryLanguageManagementEntry[];
  active_locales: string[];
}
export interface CountryLanguagePublication {
  default_locale: string;
  countries: CountryLanguageEntry[];
}
export interface RefreshInput {
  locale: string;
  version: number;
  is_active: boolean;
}
