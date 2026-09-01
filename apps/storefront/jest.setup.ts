import '@testing-library/jest-dom';

// jsdom doesn't implement ResizeObserver, which Radix UI primitives (used by
// @medusajs/ui's Checkbox/Select, underlying the account and checkout forms)
// call on mount. Stub it so components using them are renderable in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom also doesn't implement the streams API. @medusajs/js-sdk's client
// (imported transitively by most `@/lib/data/*` modules, which many
// components import for their data-fetching actions) references
// TransformStream at module load time. Node provides a real implementation
// via `stream/web` — wire it up so importing those modules doesn't throw in
// tests that don't otherwise mock them out.
if (typeof globalThis.TransformStream === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TransformStream } = require('stream/web');
  globalThis.TransformStream = TransformStream;
}
