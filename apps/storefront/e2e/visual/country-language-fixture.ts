import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { APIRequestContext, expect, TestInfo } from '@playwright/test';

/**
 * Real-backend fixture for the country-language journeys (NIMBUS-176). It needs a running Medusa
 * backend with seeded regions, an Admin user and the storefront's publishable key; it changes that
 * backend's data (a ninth language, a region country, one assignment) and restores what it can.
 * Never point it at a shared or production backend.
 */
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:9000';
export const NINTH_COUNTRY = process.env.E2E_NINTH_COUNTRY ?? 'nl';
export const NINTH_LOCALE = process.env.E2E_NINTH_LOCALE ?? 'nl';
// Prefixed to every copied English text, so a rendered page shows which language's texts it uses.
export const NINTH_TEXT_MARKER = `[${NINTH_LOCALE}] `;
// The backend's NODE_ENV. Medusa sets `SameSite=Lax; Secure` on its session cookie only in
// production and staging, and no SameSite attribute otherwise
// (`@medusajs/framework/dist/http/express-loader.js`, `resolveSessionCookieSecurity`).
export const BACKEND_NODE_ENV = process.env.E2E_BACKEND_NODE_ENV ?? 'development';
export const BACKEND_IS_PRODUCTION_LIKE = ['production', 'staging'].includes(BACKEND_NODE_ENV);

const REQUIRED_ENV = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY'];

/** The reason the journey cannot run here, or null when its environment is configured. */
export function missingFixtureEnvironment(): string | null {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  return missing.length ? `country-language journey needs ${missing.join(', ')} and a running backend` : null;
}

export type CountryLanguageManagement = {
  version: number;
  default_locale: string;
  countries: { country_code: string; locale: string; source: 'explicit' | 'default'; configured: boolean }[];
  active_locales: string[];
};

export type CountryLanguagePublication = {
  default_locale: string;
  countries: { country_code: string; locale: string; source: 'explicit' | 'default' }[];
};

type Messages = { [key: string]: string | Messages };

function markMessages(messages: Messages): Messages {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      key,
      typeof value === 'string' ? `${NINTH_TEXT_MARKER}${value}` : markMessages(value),
    ])
  );
}

/**
 * Logs in through the real auth routes; the session cookie lands in the request's browser context.
 * Returns the raw `Set-Cookie` header of the session cookie, as the backend sent it.
 */
export async function loginAdmin(request: APIRequestContext): Promise<string | undefined> {
  const login = await request.post(`${BACKEND_URL}/auth/user/emailpass`, {
    data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  });
  expect(login.ok(), 'Admin login').toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  const session = await request.post(`${BACKEND_URL}/auth/session`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(session.ok(), 'Admin session').toBeTruthy();
  return session
    .headersArray()
    .find((header) => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('connect.sid='))?.value;
}

export async function readManagement(request: APIRequestContext): Promise<CountryLanguageManagement> {
  const response = await request.get(`${BACKEND_URL}/admin/country-languages`);
  expect(response.status(), 'GET /admin/country-languages').toBe(200);
  return (await response.json()) as CountryLanguageManagement;
}

export async function readPublication(request: APIRequestContext): Promise<CountryLanguagePublication> {
  const response = await request.get(`${BACKEND_URL}/store/country-languages`, {
    headers: { 'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '' },
  });
  expect(response.status(), 'GET /store/country-languages').toBe(200);
  return (await response.json()) as CountryLanguagePublication;
}

export async function assignCountryLanguage(
  request: APIRequestContext,
  countryCode: string,
  locale: string
): Promise<CountryLanguageManagement> {
  const { version } = await readManagement(request);
  const response = await request.post(`${BACKEND_URL}/admin/country-languages/${countryCode}`, {
    data: { locale, expected_version: version },
  });
  expect(response.status(), `assign ${countryCode} to ${locale}`).toBe(200);
  return (await response.json()) as CountryLanguageManagement;
}

/** What the fixture changed, so `restoreFixture` can put it back. */
export type FixtureState = {
  createdLocale: boolean;
  addedToRegion: { id: string; countries: string[] } | null;
  previousLocale: string | null;
};

/**
 * Brings the backend to the journey's starting point: country languages initialized (the operator
 * bootstrap, which never overwrites), the ninth country in a region, and the ninth language active
 * with marked copies of the English texts.
 */
export async function prepareFixture(request: APIRequestContext, testInfo: TestInfo): Promise<FixtureState> {
  if ((await request.get(`${BACKEND_URL}/admin/country-languages`)).status() === 503) {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const output = execFileSync(
      'pnpm',
      ['--filter', '@b2b-starter/backend', 'exec', 'medusa', 'exec', './src/scripts/bootstrap-country-languages.ts', '--apply'],
      { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' }
    );
    await testInfo.attach('bootstrap-output.txt', { body: output, contentType: 'text/plain' });
  }

  const state: FixtureState = { createdLocale: false, addedToRegion: null, previousLocale: null };

  const before = await readManagement(request);
  const ninth = before.countries.find((entry) => entry.country_code === NINTH_COUNTRY);
  if (!ninth?.configured) {
    const regions = await request.get(`${BACKEND_URL}/admin/regions?fields=id,countries.iso_2&limit=1`);
    expect(regions.ok(), 'list regions').toBeTruthy();
    const [region] = ((await regions.json()) as { regions: { id: string; countries: { iso_2: string }[] }[] })
      .regions;
    const countries = region.countries.map((country) => country.iso_2);
    const update = await request.post(`${BACKEND_URL}/admin/regions/${region.id}`, {
      data: { countries: [...countries, NINTH_COUNTRY] },
    });
    expect(update.ok(), `add ${NINTH_COUNTRY} to region ${region.id}`).toBeTruthy();
    state.addedToRegion = { id: region.id, countries };
  }
  state.previousLocale = ninth?.source === 'explicit' ? ninth.locale : null;

  if (!before.active_locales.includes(NINTH_LOCALE)) {
    const locales = (await (await request.get(`${BACKEND_URL}/admin/ui-translations`)).json()) as {
      locales: { locale: string; version: number; is_active: boolean }[];
    };
    let target = locales.locales.find((entry) => entry.locale === NINTH_LOCALE);
    if (!target) {
      const english = (await (await request.get(`${BACKEND_URL}/admin/ui-translations/en`)).json()) as {
        translation: { messages: Messages };
      };
      const created = await request.post(`${BACKEND_URL}/admin/ui-translations`, {
        data: { locale: NINTH_LOCALE, source: 'import', messages: markMessages(english.translation.messages) },
      });
      expect(created.status(), `create ${NINTH_LOCALE}`).toBe(201);
      target = ((await created.json()) as { translation: { locale: string; version: number; is_active: boolean } })
        .translation;
      state.createdLocale = true;
    }
    const activation = await request.post(`${BACKEND_URL}/admin/ui-translations/${NINTH_LOCALE}/activation`, {
      data: { expected_version: target.version, is_active: true },
    });
    expect(activation.ok(), `activate ${NINTH_LOCALE}`).toBeTruthy();
  }
  return state;
}

/** Undoes the assignment, region change and language activation the fixture made. */
export async function restoreFixture(request: APIRequestContext, state: FixtureState): Promise<void> {
  const current = await readManagement(request);
  const ninth = current.countries.find((entry) => entry.country_code === NINTH_COUNTRY);
  if (ninth && ninth.locale !== (state.previousLocale ?? current.default_locale)) {
    await assignCountryLanguage(request, NINTH_COUNTRY, state.previousLocale ?? current.default_locale);
  }
  if (state.createdLocale) {
    const locales = (await (await request.get(`${BACKEND_URL}/admin/ui-translations`)).json()) as {
      locales: { locale: string; version: number }[];
    };
    const target = locales.locales.find((entry) => entry.locale === NINTH_LOCALE);
    if (target) {
      await request.post(`${BACKEND_URL}/admin/ui-translations/${NINTH_LOCALE}/activation`, {
        data: { expected_version: target.version, is_active: false },
      });
    }
  }
  if (state.addedToRegion) {
    await request.post(`${BACKEND_URL}/admin/regions/${state.addedToRegion.id}`, {
      data: { countries: state.addedToRegion.countries },
    });
  }
}
