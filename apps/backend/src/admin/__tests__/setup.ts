import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// jsdom lacks TextEncoder/TextDecoder, which react-router needs when the data router is loaded.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

// jsdom lacks ResizeObserver, which Radix primitives behind @medusajs/ui call on mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Radix Select uses pointer capture and scrollIntoView, which jsdom does not implement.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
