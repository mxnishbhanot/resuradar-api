import { chromium } from "playwright";
import { getPdfMarginCss } from "../config/print-spec.js";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/**
 * Shared Playwright path for PDF export and preview page-break measurement.
 * Keeps viewport, waits, and print emulation identical to export.
 * @param {string} html
 * @param {(ctx: { page: import('playwright').Page; browser: import('playwright').Browser }) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPrintLayoutPage(html, fn) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: LAUNCH_ARGS,
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.setContent(html, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(500);

    return await fn({ page, browser });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export const generatePDF = async (html) => {
  return withPrintLayoutPage(html, async ({ page }) => {
    const margin = getPdfMarginCss();
    return page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin,
      displayHeaderFooter: false,
      scale: 1.0,
    });
  });
};
