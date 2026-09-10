import { Page } from '@playwright/test';

/**
 * Waits for every <img> on the page to finish loading and decoding.
 *
 * Next.js's <Image> lazily loads and blur-up-transitions product thumbnails;
 * without this, `toHaveScreenshot()` can capture a frame mid-load (partially
 * rendered image), producing small, non-deterministic pixel diffs on an
 * otherwise-unchanged page (observed on plp/pdp during Task 02 baseline
 * generation).
 */
export async function waitForImagesToLoad(page: Page) {
  // `toHaveScreenshot({ fullPage: true })` captures the entire document,
  // including images that are below the fold at the time this runs. Next.js
  // <Image> uses native `loading="lazy"`, so the browser won't fetch those
  // until they scroll near the viewport — which hasn't happened yet. Forcing
  // `loading="eager"` makes the browser fetch everything immediately so the
  // wait below can actually resolve.
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      (img as HTMLImageElement).loading = 'eager';
    });
  });
  await page.waitForFunction(() =>
    Array.from(document.images)
      // Skip images hidden by this app's responsive `hidden`/breakpoint
      // classes (e.g. desktop-only imagery on a mobile viewport) — browsers
      // may never fetch an off-screen/display:none image, so waiting on it
      // would hang rather than reflect anything the screenshot can show.
      .filter((img) => img.offsetParent !== null)
      .every((img) => img.complete && img.naturalWidth > 0)
  );
}
