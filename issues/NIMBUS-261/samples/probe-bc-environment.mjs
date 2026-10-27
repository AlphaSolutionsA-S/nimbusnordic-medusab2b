// Read-only probe of a Business Central environment for NIMBUS-261 (run before dispatch).
//
// Every Business Central request is a GET. The only POST is the OAuth token request to Entra ID.
// Prints status codes, counts, company names and GUIDs, and per-country counts of customers. It
// never prints the token, the client secret, the tenant id, a customer number, a customer name or
// any address.
//
// Usage (PowerShell, from the repo root):
//   $env:BUSINESS_CENTRAL_CLIENT_ID = "<shared app registration client id>"
//   $env:BUSINESS_CENTRAL_CLIENT_SECRET = "<shared secret>"
//   $env:PROBE_DISCOVERY_URL = "https://api.businesscentral.dynamics.com/v2.0/<tenant>/TestNO/api/v2.0"
//   $env:PROBE_COMPANY_ID = "<NO BC company GUID, optional when the environment has one company>"
//   $env:PROBE_CUSTOMER_NUMBER = "<a Norwegian customer number, optional>"
//   node issues/NIMBUS-261/samples/probe-bc-environment.mjs
//
// Refuses any environment whose name does not start with "Test" unless PROBE_ALLOW_PRODUCTION=1.

const CUSTOMER_PORTAL_API_PATH = "api/abakion/customerPortal/v2.0";
const CUSTOMER_SAMPLE_SIZE = 500;

function fail(message) {
  console.error(`PROBE FAILED: ${message}`);
  process.exit(1);
}

function parseDiscoveryUrl(value) {
  let url;
  try {
    url = new URL(value ?? "");
  } catch {
    fail("PROBE_DISCOVERY_URL is missing or not a URL");
  }
  const [apiVersion, tenant, environment] = url.pathname.split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "api.businesscentral.dynamics.com") {
    fail("PROBE_DISCOVERY_URL must target https://api.businesscentral.dynamics.com");
  }
  if (apiVersion !== "v2.0" || !tenant || !environment) {
    fail("PROBE_DISCOVERY_URL must have the shape /v2.0/{tenant}/{environment}/api/v2.0");
  }
  return {
    discovery: url.toString().replace(/\/$/, ""),
    environmentBase: `https://${url.hostname}/v2.0/${tenant}/${environment}`,
    tenant,
    environment,
  };
}

async function requestToken(tenant) {
  const clientId = process.env.BUSINESS_CENTRAL_CLIENT_ID;
  const clientSecret = process.env.BUSINESS_CENTRAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    fail("BUSINESS_CENTRAL_CLIENT_ID and BUSINESS_CENTRAL_CLIENT_SECRET are required");
  }
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://api.businesscentral.dynamics.com/.default",
    }).toString(),
  });
  if (!response.ok) {
    fail(`token request returned ${response.status}`);
  }
  const body = await response.json();
  return body.access_token;
}

async function get(url, token) {
  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function report(label, value) {
  console.log(`${label.padEnd(58)} ${value}`);
}

async function main() {
  const target = parseDiscoveryUrl(process.env.PROBE_DISCOVERY_URL);
  if (!target.environment.startsWith("Test") && process.env.PROBE_ALLOW_PRODUCTION !== "1") {
    fail(`environment '${target.environment}' is not a test environment (set PROBE_ALLOW_PRODUCTION=1)`);
  }
  report("Environment", target.environment);

  const token = await requestToken(target.tenant);

  // 1. Companies in the environment: the standard API calls in service.ts carry no companies()
  //    segment, so BC's default company must be the configured one.
  const companies = await get(`${target.discovery}/companies`, token);
  const companyRows = companies.body?.value ?? [];
  report("GET companies", `${companies.status}, ${companyRows.length} companies`);
  for (const company of companyRows) {
    report("  company", `${company.id}  name='${company.name}'`);
  }

  const companyId = process.env.PROBE_COMPANY_ID || (companyRows.length === 1 ? companyRows[0].id : "");
  if (!companyId) {
    fail("several companies: set PROBE_COMPANY_ID to the Nimbus Nordic NO company GUID");
  }
  const company = companyRows.find((row) => row.id === companyId);
  report("Configured company GUID", companyId);
  report("Configured company ODataV4 name", company ? `'${company.name}'` : "NOT IN LIST");
  if (!company) {
    fail("PROBE_COMPANY_ID is not a company of this environment");
  }
  const odataCompany = `company='${company.name.replace(/'/g, "''")}'`;

  // 2. Default-company resolution: the same first customer with and without companies().
  const scoped = await get(`${target.discovery}/companies(${companyId})/customers?$top=1&$select=id`, token);
  const unscoped = await get(`${target.discovery}/customers?$top=1&$select=id`, token);
  const sameCustomer =
    scoped.body?.value?.[0]?.id !== undefined && scoped.body?.value?.[0]?.id === unscoped.body?.value?.[0]?.id;
  report("GET customers (scoped / unscoped)", `${scoped.status} / ${unscoped.status}`);
  report("Unscoped standard API resolves to the configured company", sameCustomer ? "yes" : "NO");

  // 3. Standard API entity sets the portal reads.
  for (const entitySet of ["salesOrders", "salesInvoices", "salesReturnOrders"]) {
    const result = await get(`${target.discovery}/${entitySet}?$top=1&$select=id`, token);
    report(`GET ${entitySet}`, result.status);
  }

  // 4. Custom customer-portal API.
  for (const entitySet of ["salesReturnOrders", "salesOrderReservationEntries"]) {
    const result = await get(
      `${target.environmentBase}/${CUSTOMER_PORTAL_API_PATH}/companies(${companyId})/${entitySet}?$top=1`,
      token
    );
    report(`GET customerPortal/v2.0 ${entitySet}`, result.status);
  }

  // 5. ODataV4 web services: return reasons, posted return receipts and their lines.
  const reasons = await get(`${target.environmentBase}/ODataV4/CS_EnabledReasonCodes?${odataCompany}`, token);
  const reasonRows = reasons.body?.value ?? [];
  report("GET ODataV4 CS_EnabledReasonCodes", `${reasons.status}, ${reasonRows.length} reasons`);
  const reasonCodes = [...new Set(reasonRows.map((row) => row.ReasonCode).filter(Boolean))];
  report("  reason codes", reasonCodes.join(", ") || "-");
  // The return step accepts only NORMAL today (prepare-bc-return.ts).
  report("  NORMAL is an enabled reason code", reasonCodes.includes("NORMAL") ? "yes" : "NO");
  for (const webService of ["PostedReturnReceipt", "PostedReturnReceiptReturnRcptLines"]) {
    const result = await get(`${target.environmentBase}/ODataV4/${webService}?${odataCompany}&$top=1`, token);
    report(`GET ODataV4 ${webService}`, result.status);
  }
  // The create-return action is a POST and is not called; its web service must be published.
  const metadataResponse = await fetch(`${target.environmentBase}/ODataV4/$metadata?${odataCompany}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/xml" },
  });
  const metadataText = metadataResponse.ok ? await metadataResponse.text() : "";
  report("GET ODataV4 $metadata", metadataResponse.status);

  // 6. Country codes and blank currencies on customer cards (counts only).
  const sample = await get(
    `${target.discovery}/companies(${companyId})/customers?$top=${CUSTOMER_SAMPLE_SIZE}&$select=country,currencyCode`,
    token
  );
  const countryCounts = new Map();
  let blankCurrency = 0;
  for (const row of sample.body?.value ?? []) {
    const country = JSON.stringify(row.country ?? null);
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    if (!row.currencyCode) {
      blankCurrency += 1;
    }
  }
  report(`Customer country values (first ${CUSTOMER_SAMPLE_SIZE})`, [...countryCounts].map(([c, n]) => `${c}:${n}`).join(" "));
  report("Customers with a blank currency code", blankCurrency);

  // 7. Optional: one known Norwegian customer number.
  const customerNumber = process.env.PROBE_CUSTOMER_NUMBER;
  if (customerNumber) {
    const customer = await get(
      `${target.discovery}/customers?$filter=number eq '${customerNumber.replace(/'/g, "''")}'&$top=1&$expand=currency`,
      token
    );
    const row = customer.body?.value?.[0];
    report("Sample customer found", row ? "yes" : "no");
    if (row) {
      report("  card country", JSON.stringify(row.country ?? null));
      report("  card currency code", JSON.stringify(row.currency?.code ?? row.currencyCode ?? null));
    }
  }

  report("$metadata mentions CustomerPortalReturns", metadataText.includes("CustomerPortalReturns") ? "yes" : "no (check manually)");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
