# NIMBUS-130 — Manual test calls (APIM `GET /shipment-notices/{token}`)

**Manual testing required.** Run these against the deployed APIM operation after
`deployment-instructions.md`. Replace `<APIM>` with `https://<apim-host>/<api-suffix>`; add the
subscription-key header if the API requires one. Use the APIM Test tab with tracing to see the
transformed body, and the Logic App run history to see what was forwarded.

Seed data (a Medusa environment where the poll job has stored notices, or notices stored for a test
company):

- Token `a1b2c3d4e5f6` → `bccustomernumber` of a company with at least **3** shipment notices.
- Token `missing-customer-number` → `bccustomernumber: ""`.
- Token `unknown-customer` → a `bccustomernumber` no Medusa company has.
- A second company with at least one notice (`OTHER-NUMBER`), to prove isolation.

Every XML body below must validate against `shipment-notice-schema.xsd` and carry
`Content-Type: application/xml`.

## TC-1: Unknown token

```http
GET <APIM>/shipment-notices/does-not-exist
```

Expect `401 {"error":"Token not recognized"}`. In the run history, `Get_Shipment_Notices_From_Medusa`
did not run.

## TC-2: Token without a customer number

```http
GET <APIM>/shipment-notices/missing-customer-number
```

Expect `401 {"error":"Not allowed"}`; `Response_Not_Allowed` ran and Medusa was not called.

## TC-3: First call

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6
```

Expect `200`, JSON, `Content-Type: application/json`: the oldest notices of this company first, up to
50, each with `cursor`, `status` (`shipped`/`revised`/`cancelled`), `lines`; `next_cursor` and
`has_more`. The body validates against `shipment-notice-schema.json`. In the run history the Medusa
URL is `…/orderapi/shipment-notices?customerNumber=<number>` with nothing else.

## TC-4: Paging with `after`

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?limit=2
GET <APIM>/shipment-notices/a1b2c3d4e5f6?limit=2&after=<next_cursor of the first call>
```

Expect the first call to return 2 notices with `has_more: true`; the second starts with the notice
after that cursor and repeats none of the first page. Keep calling with each `next_cursor` until
`has_more` is `false`; the last call returns the final `next_cursor`. A call with `after=<last
next_cursor>` returns an empty `shipment_notices` array. The Medusa URL carries `&after=…&limit=2`.

## TC-5: `since`

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?since=2026-10-20T00:00:00Z
```

Expect only notices with `recorded_at` on or after that time. `after` and `since` together →
`400 {"type":"invalid_data",…}` from Medusa.

## TC-6: XML success

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?limit=2
Accept: application/xml
```

Expect `200`, `Content-Type: application/xml`, root `<shipment_notice_response>` with
`<shipment_notices><shipment_notice>…<lines><line>…`, no element for a field that is `null` in TC-4's
JSON of the same page, and every value (including `recorded_at`) equal to that JSON. Validates
against the XSD.

## TC-7: XML error, 401

```http
GET <APIM>/shipment-notices/does-not-exist
Accept: application/xml
```

Expect `401`, `<error_response><error>Token not recognized</error></error_response>` (no `<message>`).

## TC-8: XML error, 400

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?after=abc
Accept: application/xml
```

Expect `400`, `<error_response><error>invalid_data</error><message>…</message></error_response>`; no
`<code>` element.

## TC-9: XML error, 404

```http
GET <APIM>/shipment-notices/unknown-customer
Accept: application/xml
```

Expect `404`, `<error_response><error>not_found</error><message>Customer not found</message></error_response>`.
The customer number appears nowhere in the body.

## TC-10: Injected `customerNumber` is ignored

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?customerNumber=OTHER-NUMBER
GET <APIM>/shipment-notices/a1b2c3d4e5f6?CustomerNumber=OTHER-NUMBER&limit=2
```

Expect the same notices as TC-3 (resp. TC-4's first page): the token's company only, none of
`OTHER-NUMBER`'s. In the run history the trigger's `queries` hold no `customerNumber`
(APIM dropped it) and the Medusa URL has exactly one `customerNumber`, the token's.

## TC-11: Injection through an encoded value

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6?after=0%26customerNumber%3DOTHER-NUMBER
```

Expect `400 {"type":"invalid_data",…}` from Medusa: the value reaches Medusa as one encoded `after`
(`after=0%26customerNumber%3DOTHER-NUMBER`), never as a second parameter.

## TC-12: APIM's own error (only if the API requires a subscription key)

```http
GET <APIM>/shipment-notices/a1b2c3d4e5f6
Accept: application/xml
```

without the subscription key. Expect `401`,
`<error_response><error>SubscriptionKeyNotFound</error><message>Access denied due to missing subscription key…</message></error_response>`;
without the `Accept` header, `{"error":"SubscriptionKeyNotFound","message":"…"}`.

## TC-13 (optional): Medusa unreachable

In a test environment only, point the call at an unreachable Medusa (or stop it). Expect a 5xx
rendered as `<error_response>` with `Accept: application/xml`, and no Medusa key or URL in the body.

## Outcome tracking

- [ ] TC-1 — result: _______
- [ ] TC-2 — result: _______
- [ ] TC-3 — result: _______
- [ ] TC-4 — result: _______
- [ ] TC-5 — result: _______
- [ ] TC-6 — result: _______
- [ ] TC-7 — result: _______
- [ ] TC-8 — result: _______
- [ ] TC-9 — result: _______
- [ ] TC-10 — result: _______
- [ ] TC-11 — result: _______
- [ ] TC-12 — result: _______ (n/a if no subscription key)
- [ ] TC-13 — result: _______ (optional)
