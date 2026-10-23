// Keys under which Medusa stores each custom page's arrangement and derives its widget places
// (`<key>.before`, `<key>.after`, ...). Medusa matches a widget's zone to a page by plain prefix, so
// no key may start another; `__tests__/page-keys.test.tsx` checks every string exported here.
// A key must also not equal, start or be started by a `widgetsZonePrefix` of Medusa's own pages
// (`@medusajs/dashboard`, e.g. `translation.list`, `order.list`), or the two pages share saved
// arrangements and widgets. Changing a key drops every saved arrangement for that page.

export const APPROVAL_LIST_PAGE_KEY = "approval.list";
export const COMPANY_LIST_PAGE_KEY = "company.list";
export const COMPANY_DETAILS_PAGE_KEY = "company.details";
export const QUOTE_LIST_PAGE_KEY = "quote.list";
export const QUOTE_DETAILS_PAGE_KEY = "quote.details";
// Not `translation.list`: Medusa's Translations settings page uses that key.
export const TRANSLATION_LIST_PAGE_KEY = "storefront_translation.list";
export const SHIPMENT_TRACKING_LIST_PAGE_KEY = "shipment_tracking.list";
