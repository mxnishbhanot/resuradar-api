/**
 * Post-processes resume standard analysis so premium sections stay readable
 * and trustworthy (merge fragmented suggestions; normalize rewrite shape).
 */

const DEFAULT_MAX_ITEMS = 8;
const DEFAULT_MERGE_ACCRUAL_MAX = 220;
const DEFAULT_SHORT_FRAGMENT_LEN = 72;
const DEFAULT_MIN_LONG_SEGMENT = 90;

/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 */
function clampNum(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Merges fragmented bullet strings into fewer complete lines.
 * @param {unknown} items
 * @param {{ maxItems?: number, mergeAccrualMax?: number, shortFragmentLen?: number, minCharsForLongSegment?: number }} [options]
 * @returns {string[]}
 */
export function coalesceFragmentedBulletList(items, options = {}) {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const mergeAccrualMax = options.mergeAccrualMax ?? DEFAULT_MERGE_ACCRUAL_MAX;
  const shortFragmentLen = options.shortFragmentLen ?? DEFAULT_SHORT_FRAGMENT_LEN;
  const minCharsForLongSegment = options.minCharsForLongSegment ?? DEFAULT_MIN_LONG_SEGMENT;

  if (!Array.isArray(items)) return [];
  const strings = items
    .map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean);
  if (!strings.length) return [];

  const mostlyLong =
    strings.length <= maxItems && strings.every((s) => s.length >= minCharsForLongSegment);
  if (mostlyLong) return strings.slice(0, maxItems);

  const merged = [];
  let acc = "";

  const flush = () => {
    const t = acc.replace(/\s+/g, " ").trim();
    if (t) merged.push(t.length > 1400 ? `${t.slice(0, 1397)}…` : t);
    acc = "";
  };

  for (const s of strings) {
    if (!acc) {
      acc = s;
      continue;
    }
    const accShort = acc.length < mergeAccrualMax;
    const pieceShort = s.length < shortFragmentLen;
    const startsLower = /^[a-z]/.test(s);
    if (accShort || pieceShort || startsLower) {
      acc = `${acc} ${s}`.replace(/\s+/g, " ").trim();
    } else {
      flush();
      acc = s;
    }
  }
  flush();

  return merged.slice(0, maxItems);
}

/**
 * Merges an array of tiny strings (model split one paragraph across many items)
 * into a small number of full suggestions.
 * @param {unknown} items
 * @returns {string[]}
 */
export function coalesceDetailedSuggestions(items) {
  return coalesceFragmentedBulletList(items);
}

/**
 * @param {unknown} raw
 * @returns { { original: string, suggestion: string }[] }
 */
export function normalizeResumeRewrites(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];

  for (const item of raw) {
    if (item && typeof item === "object") {
      const o = typeof item.original === "string" ? item.original.trim() : "";
      const s = typeof item.suggestion === "string" ? item.suggestion.trim() : "";
      if (o && s) out.push({ original: o, suggestion: s });
      continue;
    }
    if (typeof item === "string") {
      const t = item.replace(/\s+/g, " ").trim();
      const m = t.match(/Original:\s*([\s\S]*?)\s*(?:Rewrite|Suggestion):\s*([\s\S]*)/i);
      if (m) {
        const o = m[1].trim();
        const s = m[2].trim();
        if (o && s) out.push({ original: o, suggestion: s });
      } else if (t) {
        out.push({ original: "", suggestion: t });
      }
    }
  }

  return out.slice(0, 8);
}

/**
 * @param {unknown} pfb
 * @returns {Record<string, unknown>}
 */
const emptyPremium = () => ({
  detailed_suggestions: [],
  rewrites: [],
  portfolio_tips: [],
  keywords: [],
  professional_level: "",
});

const emptyJobMatchPremium = () => ({
  keyword_analysis: { total_keywords_in_jd: 0, matched_keywords: 0, missing_keywords: [] },
  role_fit_breakdown: {
    technical_skills_fit: 0,
    experience_fit: 0,
    education_fit: 0,
    soft_skills_fit: 0,
    overall_fit: 0,
  },
  recommendations: [],
  suggested_rewrites: [],
});

/**
 * JD match premium block: clamp scores, trim keywords, coalesce fragmented recommendations, normalize rewrites.
 * @param {unknown} premium
 * @param {number} overallMatchScore — written into role_fit_breakdown.overall_fit
 */
export function normalizeJobMatchPremiumFeedback(premium, overallMatchScore) {
  if (!premium || typeof premium !== "object") return emptyJobMatchPremium();

  const kw = premium.keyword_analysis && typeof premium.keyword_analysis === "object" ? premium.keyword_analysis : {};
  let total = clampNum(kw.total_keywords_in_jd, 0, 500);
  let matched = clampNum(kw.matched_keywords, 0, 500);
  if (matched > total) matched = total;
  const missing = Array.isArray(kw.missing_keywords)
    ? kw.missing_keywords
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  const role = premium.role_fit_breakdown && typeof premium.role_fit_breakdown === "object" ? premium.role_fit_breakdown : {};
  const breakdown = {
    technical_skills_fit: clampNum(role.technical_skills_fit, 0, 100),
    experience_fit: clampNum(role.experience_fit, 0, 100),
    education_fit: clampNum(role.education_fit, 0, 100),
    soft_skills_fit: clampNum(role.soft_skills_fit, 0, 100),
    overall_fit: clampNum(overallMatchScore, 0, 100),
  };

  const recommendations = coalesceFragmentedBulletList(premium.recommendations, {
    maxItems: 10,
    minCharsForLongSegment: 52,
    mergeAccrualMax: 200,
    shortFragmentLen: 65,
  });

  return {
    ...premium,
    keyword_analysis: {
      total_keywords_in_jd: total,
      matched_keywords: matched,
      missing_keywords: missing,
    },
    role_fit_breakdown: breakdown,
    recommendations,
    suggested_rewrites: normalizeResumeRewrites(premium.suggested_rewrites),
  };
}

/**
 * @param {unknown} fb
 */
export function normalizeJobMatchFreeFeedback(fb) {
  if (!fb || typeof fb !== "object") return fb;
  const trimList = (arr, max) =>
    Array.isArray(arr)
      ? arr
          .map((x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : ""))
          .filter(Boolean)
          .slice(0, max)
      : [];
  return {
    ...fb,
    summary: typeof fb.summary === "string" ? fb.summary.trim() : fb.summary,
    match_level: typeof fb.match_level === "string" ? fb.match_level.trim() : fb.match_level,
    strengths: trimList(fb.strengths, 10),
    gaps: trimList(fb.gaps, 10),
  };
}

export function normalizePremiumFeedback(pfb) {
  if (!pfb || typeof pfb !== "object") return emptyPremium();

  const portfolio_tips = Array.isArray(pfb.portfolio_tips)
    ? pfb.portfolio_tips
        .map((t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : ""))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const keywords = Array.isArray(pfb.keywords)
    ? pfb.keywords
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter(Boolean)
        .slice(0, 40)
    : [];

  const professional_level =
    typeof pfb.professional_level === "string" ? pfb.professional_level.trim() : "";

  return {
    ...pfb,
    detailed_suggestions: coalesceDetailedSuggestions(pfb.detailed_suggestions),
    rewrites: normalizeResumeRewrites(pfb.rewrites),
    portfolio_tips,
    keywords,
    professional_level,
  };
}
