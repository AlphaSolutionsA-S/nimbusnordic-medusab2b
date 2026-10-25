// NIMBUS-231 planning: read-only TestDK probe of TRCShipmentLine paging (GET only; one token
// request). Refuses any environment but TestDK and prints no secret, tenant or company id.
// Run from the repo root: node issues/NIMBUS-231/samples/probe-trc-paging.mjs apps/backend/.env
// Answers: is @odata.nextLink on the same origin as the request (the adapter refuses any other)?
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[2], "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
const discovery = new URL(env.BUSINESS_CENTRAL_DISCOVERY_URL);
const [, tenant, environment] = discovery.pathname.split("/").filter(Boolean);
if (environment !== "TestDK") throw new Error("Refusing: not TestDK");
const redact = (s) => String(s).split(tenant).join("<tenant>").split(env.BUSINESS_CENTRAL_COMPANY_ID).join("<company>");

const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: env.BUSINESS_CENTRAL_CLIENT_ID,
    client_secret: env.BUSINESS_CENTRAL_CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://api.businesscentral.dynamics.com/.default",
  }).toString(),
});
const { access_token } = await tokenRes.json();
const get = (url, extra = {}) =>
  fetch(url, { headers: { authorization: `Bearer ${access_token}`, accept: "application/json", ...extra } });

const company = await (await get(`${discovery}/companies(${env.BUSINESS_CENTRAL_COMPANY_ID})`)).json();
const base = `https://${discovery.hostname}/v2.0/${tenant}/${environment}/ODataV4/TRCShipmentLine`;
const q = (filter) => {
  const u = new URL(base);
  u.searchParams.set("company", `'${company.name.replace(/'/g, "''")}'`);
  u.searchParams.set("$filter", filter);
  u.searchParams.set("$select", "documentNumber,lineNo,variantCode");
  return u;
};

// 1. nextLink shape with a small page
let res = await get(q("documentNumber eq '30947954' or documentNumber eq '30947937'"), { prefer: "odata.maxpagesize=3" });
let body = await res.json();
console.log("1 status", res.status, "rows", body.value?.length, "preference-applied", res.headers.get("preference-applied"));
const next = body["@odata.nextLink"];
console.log("1 nextLink", redact(next));
const sameOrigin = Boolean(next) && new URL(next).origin === new URL(base).origin;
if (next) console.log("1 nextLink origin equals request origin:", sameOrigin);
// Follow only on the BC origin, so the bearer token never goes to another host.
if (sameOrigin) {
  res = await get(next, { prefer: "odata.maxpagesize=3" });
  body = await res.json();
  console.log("1b status", res.status, "rows", body.value?.length, "has next", Boolean(body["@odata.nextLink"]));
}

// 2. unknown shipment number
res = await get(q("documentNumber eq 'NO-SUCH-SHIPMENT'"));
body = await res.json();
console.log("2 status", res.status, "rows", body.value?.length);

// 3. value types and padding
res = await get(q("documentNumber eq '30947879'"));
body = await res.json();
console.log("3 status", res.status, JSON.stringify(body.value?.map((r) => [typeof r.documentNumber, typeof r.lineNo, JSON.stringify(r.variantCode)])));
