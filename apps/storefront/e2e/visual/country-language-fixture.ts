import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { APIRequestContext, expect, TestInfo } from '@playwright/test';

import { PROJECT_COUNTRY_CODES } from './project-locales';

/**
 * Real-backend fixture for the country-language journeys (NIMBUS-176). It needs a running Medusa
 * backend with seeded regions, an Admin user and the storefront's publishable key; it changes that
 * backend's data (a ninth language, one assignment) and restores what it can. Never point it at a
 * shared or production backend.
 */
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:9000';
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

function getPublication(request: APIRequestContext) {
  return request.get(`${BACKEND_URL}/store/country-languages`, {
    headers: { 'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '' },
  });
}

export async function readPublication(request: APIRequestContext): Promise<CountryLanguagePublication> {
  const response = await getPublication(request);
  expect(response.status(), 'GET /store/country-languages').toBe(200);
  return (await response.json()) as CountryLanguagePublication;
}

/**
 * Runs the operator bootstrap (which never overwrites) when the backend's country languages are not
 * initialized yet (the publication answers 503). Needs only the publishable key: the bootstrap runs
 * through the backend CLI against the backend's own database, not over HTTP.
 */
export async function ensureCountryLanguagesInitialized(
  request: APIRequestContext,
  testInfo: TestInfo
): Promise<void> {
  if ((await getPublication(request)).status() !== 503) return;
  // The CLI boots the whole backend; that alone can exceed the default test timeout.
  testInfo.setTimeout(testInfo.timeout + 3 * 60_000);
  try {
    const output = execFileSync(
      'pnpm',
      ['--filter', '@b2b-starter/backend', 'exec', 'medusa', 'exec', './src/scripts/bootstrap-country-languages.ts', 'apply'],
      { cwd: path.resolve(__dirname, '../../../..'), encoding: 'utf8', shell: process.platform === 'win32' }
    );
    await testInfo.attach('bootstrap-output.txt', { body: output, contentType: 'text/plain' });
  } catch (error) {
    // Parallel workers can bootstrap at once: the loser fails fast on the configuration lock while
    // the winner commits, so a failure counts only if the publication never becomes available.
    await expect
      .poll(async () => (await getPublication(request)).status(), {
        message: `country-language bootstrap failed: ${String(error)}`,
        timeout: 60_000,
      })
      .toBe(200);
  }
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

/** The journey's country and what the fixture changed, so `restoreFixture` can put it back. */
export type FixtureState = {
  countryCode: string;
  activatedLocale: boolean;
  previousLocale: string | null;
};

/**
 * The journey's country: `E2E_NINTH_COUNTRY` when set, otherwise the first country in a region that
 * is on the default language, whether by default or by an explicit entry (an earlier run's restore
 * leaves one). Never a country added to a region during the run: storefront middleware caches the
 * region map for an hour, so it would route that country to the default one. Never a Playwright
 * project country: changing its language would change the texts under the parallel project tests.
 */
function chooseJourneyCountry(management: CountryLanguageManagement): CountryLanguageManagement['countries'][number] {
  const requested = process.env.E2E_NINTH_COUNTRY;
  if (requested) {
    if (PROJECT_COUNTRY_CODES.includes(requested)) {
      throw new Error(
        `E2E_NINTH_COUNTRY "${requested}" is a Playwright project country (${PROJECT_COUNTRY_CODES.join(', ')}). ` +
          'Choose a country in a region that no project runs in.'
      );
    }
    const entry = management.countries.find((candidate) => candidate.country_code === requested);
    if (!entry?.configured) {
      throw new Error(
        `E2E_NINTH_COUNTRY "${requested}" is not in any region. Add it to a region before starting the storefront.`
      );
    }
    return entry;
  }
  const entry = management.countries.find(
    (candidate) =>
      candidate.configured &&
      candidate.locale === management.default_locale &&
      !PROJECT_COUNTRY_CODES.includes(candidate.country_code)
  );
  if (!entry) {
    throw new Error(
      'No country in a region outside the Playwright project countries is on the default language. Set ' +
        'E2E_NINTH_COUNTRY to such a country, or add one to a region before starting the storefront.'
    );
  }
  return entry;
}

/**
 * Brings the backend to the journey's starting point: country languages initialized (the operator
 * bootstrap, which never overwrites), a country chosen from those already in a region, and the
 * ninth language active with marked copies of the English texts.
 */
export async function prepareFixture(request: APIRequestContext, testInfo: TestInfo): Promise<FixtureState> {
  await ensureCountryLanguagesInitialized(request, testInfo);

  const before = await readManagement(request);
  const country = chooseJourneyCountry(before);
  const state: FixtureState = {
    countryCode: country.country_code,
    activatedLocale: false,
    previousLocale: country.source === 'explicit' ? country.locale : null,
  };

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
    }
    const activation = await request.post(`${BACKEND_URL}/admin/ui-translations/${NINTH_LOCALE}/activation`, {
      data: { expected_version: target.version, is_active: true },
    });
    expect(activation.ok(), `activate ${NINTH_LOCALE}`).toBeTruthy();
    state.activatedLocale = true;
  }
  return state;
}

/** Undoes the assignment and language activation the fixture made. */
export async function restoreFixture(request: APIRequestContext, state: FixtureState): Promise<void> {
  // Reassign first: the backend refuses to deactivate a language that is still assigned.
  const current = await readManagement(request);
  const entry = current.countries.find((candidate) => candidate.country_code === state.countryCode);
  if (entry && entry.locale !== (state.previousLocale ?? current.default_locale)) {
    await assignCountryLanguage(request, state.countryCode, state.previousLocale ?? current.default_locale);
  }
  if (state.activatedLocale) {
    const locales = (await (await request.get(`${BACKEND_URL}/admin/ui-translations`)).json()) as {
      locales: { locale: string; version: number }[];
    };
    const target = locales.locales.find((candidate) => candidate.locale === NINTH_LOCALE);
    if (target) {
      const deactivation = await request.post(`${BACKEND_URL}/admin/ui-translations/${NINTH_LOCALE}/activation`, {
        data: { expected_version: target.version, is_active: false },
      });
      expect(deactivation.ok(), `deactivate ${NINTH_LOCALE}`).toBeTruthy();
    }
  }
}
