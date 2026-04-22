/**
 * WYSIWYG parity check.
 *
 * Same HTML is rendered under two Chromium contexts that mirror how the
 * editor iframe and the PDF export render it:
 *   - "preview": default screen media, no print emulation.
 *   - "pdf":     print media emulation (what generatePDF uses).
 *
 * For each .section and .entry we record its absolute Y offset (in mm) and
 * its height. Any delta > 1mm flags a parity drift. Wrapping is validated
 * indirectly via section/entry heights — if wrapping differs between the two
 * renders, heights diverge.
 *
 * Run from the repo root:  node resuradar-api/scripts/parity-check.mjs
 * or from resuradar-api:    node scripts/parity-check.mjs
 * Optional arg: single fixture slug, e.g. `node scripts/parity-check.mjs exact-one`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { renderTemplateHTML } from "../src/services/template-engine.js";
import { CONTENT_HEIGHT_MM, CONTENT_WIDTH_MM, TEMPLATES } from "../src/config/print-spec.js";

const PX_PER_MM = 96 / 25.4; // CSS px per mm at 96 DPI
const TOLERANCE_MM = 1.0;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const pxToMm = (px) => px / PX_PER_MM;

async function measure(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // One rAF to ensure layout has settled post font-load.
    await new Promise((r) => requestAnimationFrame(() => r()));
  });

  return page.evaluate(() => {
    const body = document.body;
    const bodyRect = body.getBoundingClientRect();
    const rowToMm = (v) => v; // passthrough, conversion done on the Node side

    const pickEls = (sel) => Array.from(document.querySelectorAll(sel));

    const sections = pickEls(".rr-section").map((el, i) => {
      const r = el.getBoundingClientRect();
      const title = el.querySelector(".rr-section-heading")?.textContent?.trim() || "";
      return {
        kind: "section",
        index: i,
        title,
        topPx: r.top - bodyRect.top,
        heightPx: r.height,
      };
    });

    const entries = pickEls(".rr-entry").map((el, i) => {
      const r = el.getBoundingClientRect();
      const title = el.querySelector(".rr-entry-title")?.textContent?.trim() || "";
      return {
        kind: "entry",
        index: i,
        title,
        topPx: r.top - bodyRect.top,
        heightPx: r.height,
      };
    });

    return {
      bodyHeightPx: bodyRect.height,
      items: [...sections, ...entries],
    };
  });
}

function diffMeasurements(preview, pdf) {
  const bodyDeltaMm = pxToMm(pdf.bodyHeightPx - preview.bodyHeightPx);
  const byKey = new Map();
  for (const it of preview.items) byKey.set(`${it.kind}#${it.index}`, { preview: it });
  for (const it of pdf.items) {
    const key = `${it.kind}#${it.index}`;
    const slot = byKey.get(key) || {};
    slot.pdf = it;
    byKey.set(key, slot);
  }
  const drifts = [];
  for (const [key, { preview: p, pdf: d }] of byKey) {
    if (!p || !d) {
      drifts.push({ key, reason: "missing in one render", p, d });
      continue;
    }
    const topDeltaMm = pxToMm(d.topPx - p.topPx);
    const heightDeltaMm = pxToMm(d.heightPx - p.heightPx);
    if (Math.abs(topDeltaMm) > TOLERANCE_MM || Math.abs(heightDeltaMm) > TOLERANCE_MM) {
      drifts.push({
        key,
        title: p.title,
        topDeltaMm: Number(topDeltaMm.toFixed(2)),
        heightDeltaMm: Number(heightDeltaMm.toFixed(2)),
      });
    }
  }
  return { bodyDeltaMm: Number(bodyDeltaMm.toFixed(2)), drifts };
}

async function runFixture(browser, fixtureFile, templateId) {
  const raw = fs.readFileSync(fixtureFile, "utf8");
  const fixture = JSON.parse(raw);
  const slug = path.basename(fixtureFile, ".json");

  // Use the real production render path — includes the injected print-spec block.
  // Skip the designer bridge to keep measurement DOM quiet.
  const html = renderTemplateHTML(fixture, templateId, {
    includeDesignerBridge: false,
  });

  // Viewport width in px covers CONTENT_WIDTH_MM at 96dpi with headroom,
  // matching the iframe container the editor uses.
  const viewport = {
    width: Math.ceil(CONTENT_WIDTH_MM * PX_PER_MM) + 40,
    height: Math.ceil(CONTENT_HEIGHT_MM * PX_PER_MM) + 40,
  };

  const ctx = await browser.newContext({ viewport });

  const preview = await ctx.newPage();
  await preview.setContent(html, { waitUntil: "networkidle" });
  const previewMeasure = await measure(preview);

  const pdfPage = await ctx.newPage();
  await pdfPage.setContent(html, { waitUntil: "networkidle" });
  await pdfPage.emulateMedia({ media: "print" });
  // Mirror the 500ms settle that puppeteer.js uses before page.pdf().
  await pdfPage.waitForTimeout(500);
  const pdfMeasure = await measure(pdfPage);

  await ctx.close();

  const { bodyDeltaMm, drifts } = diffMeasurements(previewMeasure, pdfMeasure);
  const previewBodyMm = Number(pxToMm(previewMeasure.bodyHeightPx).toFixed(2));
  const pdfBodyMm = Number(pxToMm(pdfMeasure.bodyHeightPx).toFixed(2));
  const pass = Math.abs(bodyDeltaMm) <= TOLERANCE_MM && drifts.length === 0;
  const approxPages = Math.max(1, Math.ceil(pdfBodyMm / CONTENT_HEIGHT_MM));

  return {
    slug,
    templateId,
    pass,
    previewBodyMm,
    pdfBodyMm,
    bodyDeltaMm,
    approxPages,
    drifts,
    itemCount: previewMeasure.items.length,
  };
}

function printReport(result) {
  const status = result.pass ? "PASS" : "FAIL";
  console.log(`\n── ${result.slug} × ${result.templateId} ── ${status}`);
  console.log(
    `   preview body: ${result.previewBodyMm} mm    pdf body: ${result.pdfBodyMm} mm    Δ ${result.bodyDeltaMm} mm    ~${result.approxPages} page(s)`
  );
  console.log(`   items measured: ${result.itemCount}    drifts > ${TOLERANCE_MM}mm: ${result.drifts.length}`);
  for (const d of result.drifts.slice(0, 10)) {
    if (d.reason) {
      console.log(`     • ${d.key}: ${d.reason}`);
    } else {
      console.log(`     • ${d.key} "${d.title}"   Δtop ${d.topDeltaMm}mm   Δh ${d.heightDeltaMm}mm`);
    }
  }
  if (result.drifts.length > 10) {
    console.log(`     … and ${result.drifts.length - 10} more`);
  }
}

async function main() {
  const only = process.argv[2];
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !only || path.basename(f, ".json") === only)
    .map((f) => path.join(FIXTURES_DIR, f))
    .sort();

  if (files.length === 0) {
    console.error(`No fixtures found${only ? ` matching "${only}"` : ""} in ${FIXTURES_DIR}`);
    process.exit(2);
  }

  const templateIds = Object.keys(TEMPLATES);
  const browser = await chromium.launch({ headless: true });
  let allPass = true;
  try {
    for (const f of files) {
      for (const tplId of templateIds) {
        const res = await runFixture(browser, f, tplId);
        printReport(res);
        if (!res.pass) allPass = false;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${allPass ? "✓ ALL FIXTURES PASS" : "✗ PARITY DRIFT DETECTED"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("parity-check failed:", err);
  process.exit(2);
});
