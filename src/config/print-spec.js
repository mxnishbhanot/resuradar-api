/**
 * Single source of truth for PDF page geometry (Playwright) and HTML preview alignment.
 * Body padding in templates should be 0; Playwright margins define the printable inset.
 */

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MARGIN_MM = 12;

export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * MARGIN_MM;

/** Playwright page.pdf margin option */
export function getPdfMarginCss() {
  const m = `${MARGIN_MM}mm`;
  return { top: m, bottom: m, left: m, right: m };
}

const DEFAULT_SECTION_ORDER = ["summary", "experience", "education", "projects", "skills"];

const ALLOWED_SECTIONS = new Set(DEFAULT_SECTION_ORDER);

/**
 * @param {string[]} order
 * @param {'modern'|'corporate'|'faang'|'luxury'|'executive'} templateName
 */
/** @param {string[]} order @param {string} [_templateName] reserved for per-template defaults */
export function normalizeSectionOrder(order, _templateName) {
  const base = [...DEFAULT_SECTION_ORDER];
  if (!Array.isArray(order) || order.length === 0) return base;
  const seen = new Set();
  const out = [];
  for (const k of order) {
    if (ALLOWED_SECTIONS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of base) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

/**
 * @param {object} raw
 */
export function normalizeLayout(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const scale = typeof r.globalScale === "number" && r.globalScale > 0 ? r.globalScale : 1;
  const sectionGap =
    typeof r.sectionGap === "number" && r.sectionGap > 0 ? r.sectionGap : 1;
  const lineHeight =
    typeof r.lineHeight === "number" && r.lineHeight > 0 ? r.lineHeight : 1;
  return {
    layoutVersion: 1,
    globalScale: Math.min(1.25, Math.max(0.65, scale)),
    sectionGap: Math.min(1.5, Math.max(0.7, sectionGap)),
    lineHeight: Math.min(1.35, Math.max(0.95, lineHeight)),
  };
}

/**
 * Injected after <head> so it overrides template body padding / max-width.
 * Uses zoom for global scale (Chromium / Playwright PDF).
 */
export function buildPrintSpecStyleBlock(layout) {
  const L = normalizeLayout(layout);
  return `<style id="rr-print-spec" data-rr-injected="1">
:root {
  --rr-content-width-mm: ${CONTENT_WIDTH_MM};
  --rr-content-height-mm: ${CONTENT_HEIGHT_MM};
  --rr-page-height-mm: ${PAGE_HEIGHT_MM};
  --rr-margin-mm: ${MARGIN_MM};
  --rr-resume-scale: ${L.globalScale};
  --rr-section-gap-mul: ${L.sectionGap};
  --rr-line-height-mul: ${L.lineHeight};
}
body {
  padding: 0 !important;
  max-width: ${CONTENT_WIDTH_MM}mm !important;
  width: 100% !important;
  margin: 0 auto !important;
  box-sizing: border-box !important;
  zoom: var(--rr-resume-scale, 1);
}
</style>`;
}

export function appendDesignerBridge(html) {
  const script = `<script>(function(){
  function post(type,payload){try{window.parent&&window.parent.postMessage(Object.assign({type:type},payload||{}),"*");}catch(e){}}
  document.addEventListener("click",function(e){
    var el=e.target&&e.target.closest&&e.target.closest("[data-rr-field]");
    if(!el)return;
    if(e.target&&e.target.closest&&e.target.closest("a"))return;
    post("rr-field-click",{field:el.getAttribute("data-rr-field")});
  },true);
})();<\/script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return html + script;
}
