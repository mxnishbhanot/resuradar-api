/**
 * Derives vertical positions (CSS px from top of body) where PDF page breaks occur,
 * using the same Playwright + print path as export, then anchoring PDF page-start text
 * back into the live DOM. Falls back to geometric steps when a page anchor cannot be matched.
 */

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CONTENT_HEIGHT_MM, getPdfMarginCss } from "../config/print-spec.js";
import { withPrintLayoutPage } from "./puppeteer.js";

GlobalWorkerOptions.workerSrc = import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

const PX_PER_MM = 96 / 25.4;

/**
 * @param {Buffer | Uint8Array} pdfBuffer
 * @returns {Promise<{ anchors: (string | null)[]; numPages: number }>}
 */
async function extractPageStartAnchorsFromPdf(pdfBuffer) {
  // pdf.js rejects Node Buffer; always copy into a plain Uint8Array.
  const data = new Uint8Array(pdfBuffer);
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const numPages = pdf.numPages;
  if (numPages <= 1) return { anchors: [], numPages };

  /** @type {(string | null)[]} */
  const anchors = [];

  for (let pageNumber = 2; pageNumber <= numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const tc = await page.getTextContent({ includeMarkedContent: false });
    const items = tc.items.filter((it) => it.str && String(it.str).trim());
    if (items.length === 0) {
      anchors.push(null);
      continue;
    }

    const withY = items.map((it) => ({
      str: String(it.str),
      y: /** @type {number} */ (it.transform?.[5] ?? 0),
      x: /** @type {number} */ (it.transform?.[4] ?? 0),
    }));

    const maxY = Math.max(...withY.map((w) => w.y));
    const topBand = withY.filter((w) => Math.abs(w.y - maxY) < 6);
    topBand.sort((a, b) => a.x - b.x);

    let line = topBand
      .map((w) => w.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    if (line.length < 4 && items.length > topBand.length) {
      const rest = withY
        .filter((w) => w.y < maxY - 6)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .slice(0, 6)
        .map((w) => w.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      line = `${line} ${rest}`.trim();
    }

    const clipped = line.slice(0, 120).trim();
    anchors.push(clipped.length >= 2 ? clipped : null);
  }

  return { anchors, numPages };
}

/**
 * @param {string} html
 * @returns {Promise<{ breakYsPx: number[]; pageCount: number; source: "pdf" | "geometric" }>}
 */
export async function computePreviewPageBreakYs(html) {
  return withPrintLayoutPage(html, async ({ page }) => {
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          /* ignore */
        }
      }
    });

    const margin = getPdfMarginCss();
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin,
      displayHeaderFooter: false,
      scale: 1.0,
    });

    const { anchors, numPages } = await extractPageStartAnchorsFromPdf(pdfBuffer);

    const layout = await page.evaluate(() => {
      const body = document.body;
      if (!body) {
        return { scrollHeight: 1, zoom: 1 };
      }
      const z = parseFloat(getComputedStyle(body).zoom);
      return {
        scrollHeight: Math.max(body.scrollHeight, 1),
        zoom: Number.isFinite(z) && z > 0 ? z : 1,
      };
    });

    const pageH = (CONTENT_HEIGHT_MM * PX_PER_MM) / layout.zoom;

    /** @type {number[]} */
    const ideal = [];
    for (let i = 1; i < numPages; i++) {
      ideal.push(i * pageH);
    }

    /** @type {(number | null)[]} */
    let matched =
      anchors.length === 0
        ? []
        : await page.evaluate(
            ({ anchorList }) => {
              const body = document.body;
              if (!body) return anchorList.map(() => null);

              function norm(s) {
                return String(s)
                  .replace(/\u00a0/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
              }

              /**
               * @param {string} needle
               * @returns {number | null}
               */
              function yForSubstring(needle) {
                const n = norm(needle);
                if (n.length < 2) return null;
                function tryMatch(sub, caseInsensitive) {
                  const wwalker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
                  let wn;
                  while ((wn = wwalker.nextNode())) {
                    const raw = wn.nodeValue || "";
                    const hay = caseInsensitive ? raw.toLowerCase() : raw;
                    const ndl = caseInsensitive ? sub.toLowerCase() : sub;
                    const j = hay.indexOf(ndl);
                    if (j !== -1) {
                      const r = document.createRange();
                      r.setStart(wn, j);
                      r.setEnd(wn, Math.min(j + sub.length, raw.length));
                      const rect = r.getBoundingClientRect();
                      const bodyRect = body.getBoundingClientRect();
                      return rect.top - bodyRect.top;
                    }
                  }
                  return null;
                }
                let y = tryMatch(n, false);
                if (y != null) return y;
                y = tryMatch(n, true);
                if (y != null) return y;
                const words = n.split(" ").filter(Boolean);
                for (let k = Math.min(words.length, 6); k >= 1; k--) {
                  const sub = words.slice(0, k).join(" ");
                  if (sub.length < 3) continue;
                  y = tryMatch(sub, false) ?? tryMatch(sub, true);
                  if (y != null) return y;
                }
                return null;
              }

              return anchorList.map((a) => (a ? yForSubstring(a) : null));
            },
            { anchorList: anchors },
          );

    let anyMatched = false;
    const breakYsPx = ideal.map((idealY, i) => {
      const y = matched[i];
      if (y == null || !Number.isFinite(y) || y < 4 || y > layout.scrollHeight - 4) {
        return idealY;
      }
      anyMatched = true;
      return y;
    });

    for (let i = 1; i < breakYsPx.length; i++) {
      if (breakYsPx[i] <= breakYsPx[i - 1]) {
        breakYsPx[i] = Math.min((i + 1) * pageH, layout.scrollHeight - 1);
      }
    }

    return {
      breakYsPx,
      pageCount: numPages,
      source: anyMatched ? "pdf" : "geometric",
    };
  });
}
