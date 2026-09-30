# NIMBUS-175 rollout runbook: storefront UI texts from the database

Repeat the whole procedure in **every environment** (local, staging, production). Seeding is a
manual Admin import per environment (D8). There is no seed script and no data migration. This
runbook does not authorize a deployment or a production migration; release approval is separate.

## Order at a glance

1. Deploy the backend (schema + Admin) with the storefront still on the old release.
2. Configure the secrets and callback URL.
3. Import and activate `da, de, en, fr, it, no, pl, sv` in Admin.
4. Verify the public reads.
5. Deploy the storefront.

A storefront deployed before step 3 in that environment shows raw message keys for every missing
or inactive language (scope risk R2).

## 1. Deploy the backend

- Deploy the backend release. The migration `Migration20260930183236` (module
  `storefrontTranslation`) only creates the `storefront_translation` and
  `translation_missing_key` tables and their indexes. It inserts no rows.
- Do not deploy the new storefront yet. The old storefront keeps using its bundled files.

## 2. Configure environment variables (Medusa Cloud, via `mcloud`)

| Variable | Backend | Storefront |
| --- | --- | --- |
| `STOREFRONT_TRANSLATION_REVALIDATE_URL` | `https://<storefront host>/api/translations/revalidate` | — |
| `REVALIDATE_SECRET` | same value as the storefront | existing variable; replace any template/example value |
| `TRANSLATION_REPORT_SECRET` | same value as the storefront | server-only, never `NEXT_PUBLIC_` |
| `TRANSLATION_REPORT_CLIENT_IP_HEADER` | — | optional; only a header the proxy sets **and overwrites** |

- Generate each secret with a CSPRNG, for example
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Use different
  values for the two secrets and for each environment.
- Hosted callback URLs must be HTTPS. The backend refuses plain HTTP except for loopback, as well
  as credentials in the URL and redirects. It uses a 3-second timeout.
- Check the proxy and replicas. The public report route's rate limits and the storefront's
  last-good copies are **per process**. With several storefront replicas, a refresh callback
  reaches one replica. The others converge through the 300-second timed refresh (measured locally:
  the first request after expiry still gets the old copy and triggers the refresh; the next
  request gets the new one).
- **Rotation:** set the new values on both apps and redeploy both. While the values differ, saves
  still succeed with `refresh: "deferred"` and the timed refresh applies them. Missing-text
  reports are dropped until both sides match.

## 3. Import and activate the original languages (Admin → Translations)

For each of `en` (first, so placeholder comparison is available), then `da, de, fr, it, no, pl, sv`:

1. Use the readiness panel's **Import <locale>** button, choose
   `apps/storefront/messages/<locale>.json` from the release being deployed, and select
   **Preview changes**. Expect 588 added texts, 0 removed (current catalogs).
2. Review the placeholder warnings. At the time of writing, `it` has one:
   `Checkout.review.agreementText` is missing the `<privacyLink>`/`<termsLink>` tags. Warnings do
   not block import; fix the text in Admin or in the source file.
3. **Create language**. It is created inactive.
4. **Activate** and confirm.

The readiness panel should then show all eight as "Imported, active". English does not have to
exist first; importing works without it and reports that placeholders could not be compared.

## 4. Verify before switching the storefront

- For every locale, call `GET /store/ui-translations/<locale>` with the environment's publishable
  key. Expect 200 and `is_active: true`.
- Export each language (Admin **Export saved <locale>**, or `GET
  /admin/ui-translations/<locale>/export`) and compare it with the import source **by content**.
  PostgreSQL `jsonb` does not keep object key order, so the exported file has the same keys and
  values but may list keys in a different order than the source file. Compare parsed JSON, not
  text.

## 5. Deploy the storefront

- The storefront build needs the backend reachable, with translations imported, for
  statically generated pages (risk R5).
- Smoke-test `/dk`, `/gb`, `/se` pages, page titles and metadata, a root 404 path and a country
  404. Edit one text in Admin and reload the storefront page: the change appears at once on the
  worker that received the callback, and within about 300 seconds (plus one request) on the others.
- Check **Missing texts** in Admin for genuine gaps after the first traffic.

## Ongoing operation

- **New keys from developers (R3):** developers add keys to `messages/*.json`. Before or with the
  release that uses them, an admin imports each updated file with **Merge** in every environment.
  Until then, customers see the raw key and the key appears under Missing texts.
- **New language (D16/D17):** in each environment, go to Admin → Add language (copy or import),
  translate it and activate it. Then a developer updates `SUPPORTED_LOCALES` and
  `COUNTRY_LANGUAGE_MAP` (`country-language-map.ts`), adds `formatting-locale.ts` if needed, adds a
  `messages/<locale>.json` developer file, and deploys. Never map a country to a language that is
  missing or inactive in an environment (R6). NIMBUS-176 tracks moving the mapping to the database.
- **Deactivation:** deactivating a language makes the storefront show raw keys for it. The worker
  that receives the callback does this at once; other workers follow after their timed refresh.

## Rollback

1. If runtime loading is faulty, restore the **previous storefront release** first. Its bundled
   files are a whole-release rollback, never a runtime fallback of the new release.
2. Keep the additive backend tables and their data. Export all languages before any destructive
   migration, and do not drop the tables during a routine rollback.
