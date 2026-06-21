#!/usr/bin/env node
/**
 * generate.js — Daraja Error Code Reference generator
 *
 * Reads errors.js (the single source of truth) and outputs:
 *   - errors.json          — machine-readable data for AI agents and tool callers
 *   - {slug}.html          — one standalone, indexable page per error code
 *   - {api}-errors.html    — one hub page per API surface (topical clustering)
 *   - sitemap.xml          — full sitemap with priority weights
 *   - llms.txt             — plain-text reference for LLMs that can only read text
 *
 * Run: node generate.js
 * Re-run every time errors.js changes.
 *
 * SEO / GEO features per page:
 *   - Code front-loaded title ("Error {code}: {title}")
 *   - One-sentence Quick Answer at the top (front-loaded for AI retrieval)
 *   - FAQPage JSON-LD with visible matching Q&A (top GEO structured-data type)
 *   - TechArticle + BreadcrumbList JSON-LD with dateModified (freshness signal)
 *   - First-hand "verified in sandbox" provenance where we have original data
 *   - API hub pages for topical clustering + internal linking
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Load data ────────────────────────────────────────────────────────────────

const errorsSource = fs.readFileSync(path.join(__dirname, 'errors.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(errorsSource.replace(/^\s*const\s+ERRORS\s*=/, 'ERRORS ='), sandbox);
const ERRORS = sandbox.ERRORS;

// Code → entry lookup for resolving related links
const byCode = Object.fromEntries(ERRORS.map(e => [e.code, e]));

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://ronnyabuto.github.io/daraja-error-codes';
const TODAY    = new Date().toISOString().slice(0, 10);
const LIBRARY_URL = 'https://github.com/ronnyabuto/mpesa-stk';

// High-traffic errors get sitemap priority 0.8; all others 0.7
const HIGH_TRAFFIC = new Set(['1037', '1032', '400.002.02', '500.001.1001', '2001', '404.001.03']);

// ── Quick Answers ────────────────────────────────────────────────────────────
// One-sentence direct answer per code, front-loaded so AI engines lift it
// verbatim. A code with no entry here falls back to the first sentence of its
// description, so newly added codes still get a Quick Answer automatically.
const QUICK_ANSWERS = {
  "1037": "Daraja error 1037 means the STK prompt got no response from the user's phone — it is not fatal; ask the customer to check their phone and offer a retry.",
  "1032": "Daraja error 1032 means the user cancelled the STK prompt — this is normal, not a bug; just let them re-initiate the payment.",
  "1": "Daraja error 1 means the customer has insufficient M-Pesa balance (and no Fuliza overdraft) — ask them to top up and retry.",
  "1001": "Daraja error 1001 means the subscriber already has a transaction in progress — wait 1–2 minutes and retry.",
  "1025": "Daraja error 1025 means the STK prompt could not be sent — check that TransactionDesc is under 182 characters, then retry.",
  "9999": "Daraja error 9999 is an alias of 1025 (STK prompt could not be sent) — handle it identically: check TransactionDesc length and retry.",
  "Invalid Initiator Info": "On STK Push, 'Invalid Initiator Info' means the user entered the wrong M-Pesa PIN — prompt them to retry with the correct PIN.",
  "400.002.02": "Daraja error 400.002.02 is a request-validation error — read the errorMessage suffix; it names the exact invalid field (BusinessShortCode, Timestamp, Amount, or CheckoutRequestID).",
  "Invalid Access Token (Post Go-Live)": "If your token works in sandbox but is rejected after go-live, verify all four live credentials and that your app is approved — it is usually a Safaricom approval delay, not your code.",
  "C2B Sandbox Callbacks Unreliable": "C2B sandbox callbacks fire only ~40% of the time by design — test C2B against a live deployment, not the sandbox.",
  "2001": "B2C/B2B error 2001 means your operator SecurityCredential or InitiatorName is wrong — re-encrypt using the certificate from your own Daraja portal.",
  "1019": "Daraja error 1019 means the STK prompt arrived but the user did not act in time (expired) — offer them a fresh STK push.",
  "500.001.1001": "Daraja error 500.001.1001 usually means a Timestamp/Password mismatch — generate the Timestamp once and reuse it for both the Password and the request body.",
  "401.003.01": "Error 401.003.01 means the access token was rejected at the OAuth step — regenerate it for the correct environment (sandbox vs production).",
  "404.001.03": "Error 404.001.03 means your access token is expired or missing — cache the token and refresh before its 1-hour expiry instead of regenerating per request.",
  "4999": "Daraja error 4999 is a transient 'still processing' status from the STK Query endpoint — it is not a failure; keep polling until a known terminal code, then reconcile.",
  "429": "HTTP 429 'Spike arrest' means Daraja rate-limited you — back off and retry the same request with exponential backoff; do not drop it."
};

// ── First-hand provenance ────────────────────────────────────────────────────
// Original data observed directly against the live sandbox. Signals first-hand
// expertise (E-E-A-T) to both readers and AI engines, which cite original data.
const VERIFIED = {
  "4999": "Observed live on the Daraja sandbox, June 2026.",
  "429":  "Observed live on the Daraja sandbox, June 2026 — 5 requests / 60s, burst 1."
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(code) {
  return code
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9.\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstSentence(text) {
  const m = String(text).match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : String(text)).trim();
}

function quickAnswerFor(entry) {
  return QUICK_ANSWERS[entry.code] || firstSentence(entry.description);
}

// Q&A pairs rendered BOTH as visible content and as FAQPage JSON-LD — Google
// requires structured-data Q&A to match what is visible on the page.
function faqFor(entry) {
  return [
    { q: `What does Daraja error ${entry.code} mean?`, a: quickAnswerFor(entry) },
    { q: `How do I fix Daraja error ${entry.code}?`,   a: entry.fix },
    { q: `What causes Daraja error ${entry.code}?`,    a: entry.causes.join('; ') + '.' }
  ];
}

function apiSlug(api) {
  return api.toLowerCase().replace(/\s+/g, '-');
}

// Distinct API surfaces, in first-seen order, for hub pages
const API_SURFACES = [...new Set(ERRORS.map(e => e.api))];

// ── 1. errors.json ───────────────────────────────────────────────────────────

fs.writeFileSync(
  path.join(__dirname, 'errors.json'),
  JSON.stringify(ERRORS, null, 2),
  'utf8'
);
console.log('✓  errors.json');

// ── Shared CSS ───────────────────────────────────────────────────────────────

const SHARED_CSS = `
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #222; line-height: 1.6;
    }
    .container { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .back { font-size: 13px; color: #0066ff; text-decoration: none; display: inline-block; margin-bottom: 24px; }
    .back:hover { text-decoration: underline; }
    .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 28px; }
    .card-top-row {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px; margin-bottom: 12px;
    }
    .code { font-family: monospace; font-size: 26px; font-weight: 700; color: #0066ff; }
    .api-badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; white-space: nowrap; }
    .api-stk-push { background: #fff3cd; color: #856404; }
    .api-http     { background: #f8d7da; color: #721c24; }
    .api-c2b      { background: #d1ecf1; color: #0c5460; }
    .api-b2c      { background: #d4edda; color: #155724; }
    .api-b2b      { background: #d4edda; color: #155724; }
    .api-go-live  { background: #e2d9f3; color: #4a235a; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #111; }
    p  { font-size: 14px; color: #444; margin: 0 0 8px; }
    .quick-answer {
      background: #eef5ff; border-left: 3px solid #0066ff;
      padding: 12px 14px; border-radius: 0 6px 6px 0;
      font-size: 15px; color: #14315c; margin: 0 0 16px;
    }
    .verified {
      display: inline-block; font-size: 12px; font-weight: 600;
      color: #155724; background: #e8f6ec; border: 1px solid #b7e1c1;
      padding: 3px 10px; border-radius: 12px; margin: 0 0 12px;
    }
    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #666; margin-top: 18px; margin-bottom: 6px;
    }
    ul { margin: 6px 0; padding-left: 20px; font-size: 14px; color: #444; }
    ul li { margin-bottom: 4px; }
    .fix-text {
      background: #f0fff4; border-left: 3px solid #28a745;
      padding: 10px 14px; border-radius: 0 6px 6px 0;
      font-size: 14px; margin: 0; color: #333;
    }
    .notes-text {
      background: #fff8e1; border-left: 3px solid #ffc107;
      padding: 10px 14px; border-radius: 0 6px 6px 0;
      font-size: 13px; color: #555; margin: 0;
    }
    .faq-q { font-size: 14px; font-weight: 700; color: #222; margin: 12px 0 2px; }
    .faq-a { font-size: 14px; color: #444; margin: 0 0 8px; }
    .related-list, .hub-list { list-style: none; padding: 0; margin: 6px 0; }
    .related-list li, .hub-list li { margin-bottom: 10px; }
    .related-list a, .hub-list a { color: #0066ff; text-decoration: none; font-size: 14px; font-weight: 600; }
    .related-list a:hover, .hub-list a:hover { text-decoration: underline; }
    .hub-list .ha { display: block; font-size: 13px; font-weight: 400; color: #555; margin-top: 2px; }
    .page-footer { margin-top: 32px; font-size: 13px; color: #888; text-align: center; }
    .page-footer a { color: #0066ff; text-decoration: none; }
    .page-footer a:hover { text-decoration: underline; }
    @media (max-width: 600px) {
      .card-top-row { flex-direction: column; align-items: flex-start; }
      .code { font-size: 20px; }
    }
`.trim();

const FOOTER = `    <p class="page-footer">
      Part of the <a href="${BASE_URL}/">Daraja Error Code Reference</a> —
      first-hand notes from building and stress-testing
      <a href="${LIBRARY_URL}" target="_blank" rel="noopener">mpesa-stk</a>
      against the live Daraja sandbox. Open source on
      <a href="https://github.com/ronnyabuto/daraja-error-codes" target="_blank" rel="noopener">GitHub</a>.
    </p>`;

// ── 2. Per-error HTML pages ──────────────────────────────────────────────────

for (const entry of ERRORS) {
  const slug    = slugify(entry.code);
  const pageUrl = `${BASE_URL}/${slug}.html`;
  const apiS    = apiSlug(entry.api);
  const hubUrl  = `${BASE_URL}/${apiS}-errors.html`;

  const quickAnswer = quickAnswerFor(entry);
  const verified    = VERIFIED[entry.code];
  const faq         = faqFor(entry);

  // Title: error code front-loaded — matches how developers search ("daraja error 1037")
  const pageTitle = `Error ${entry.code}: ${entry.title} | Daraja M-Pesa Error Reference`;

  const causesItems = entry.causes.map(c => `        <li>${esc(c)}</li>`).join('\n');

  const verifiedSection = verified
    ? `\n      <p class="verified">✓ ${esc(verified)}</p>`
    : '';

  const notesSection = entry.notes
    ? `\n      <div class="section-label">Notes</div>\n      <p class="notes-text">${esc(entry.notes)}</p>`
    : '';

  // Visible FAQ — content matches the FAQPage JSON-LD below
  const faqVisible = faq
    .map(({ q, a }) => `      <p class="faq-q">${esc(q)}</p>\n      <p class="faq-a">${esc(a)}</p>`)
    .join('\n');
  const faqSection = `\n      <div class="section-label">Frequently Asked Questions</div>\n${faqVisible}`;

  // Related errors — internal links for PageRank distribution + topical clustering
  let relatedSection = '';
  if (entry.related && entry.related.length) {
    const items = entry.related
      .map(code => {
        const rel = byCode[code];
        if (!rel) return '';
        return `        <li><a href="${slugify(code)}.html">Error ${esc(code)}: ${esc(rel.title)}</a></li>`;
      })
      .filter(Boolean)
      .join('\n');
    if (items) {
      relatedSection = `\n      <div class="section-label">Related Errors</div>\n      <ul class="related-list">\n${items}\n      </ul>`;
    }
  }

  const metaDesc = quickAnswer.replace(/"/g, "'").slice(0, 155);

  // TechArticle JSON-LD — dateModified signals freshness to Google
  const techArticleJsonld = JSON.stringify({
    '@context':    'https://schema.org',
    '@type':       'TechArticle',
    'headline':    `Error ${entry.code}: ${entry.title}`,
    'description':  entry.description,
    'dateModified': TODAY,
    'url':          pageUrl,
    'author':    { '@type': 'Person',       'name': 'Ronny Nyabuto' },
    'publisher': { '@type': 'Organization', 'name': 'Daraja Error Codes', 'url': BASE_URL },
    'about': [
      { '@type': 'Thing', 'name': 'Safaricom Daraja API' },
      { '@type': 'Thing', 'name': entry.api }
    ],
    'keywords': `daraja error ${entry.code}, mpesa error ${entry.code}, ${entry.api.toLowerCase()} error`
  }, null, 2);

  // FAQPage JSON-LD — each Q&A is a direct citation candidate for AI engines
  const faqJsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    'mainEntity': faq.map(({ q, a }) => ({
      '@type': 'Question',
      'name':  q,
      'acceptedAnswer': { '@type': 'Answer', 'text': a }
    }))
  }, null, 2);

  // BreadcrumbList JSON-LD — Home > {API} Errors > {code}
  const breadcrumbJsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Daraja Error Codes', 'item': `${BASE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': `${entry.api} Errors`, 'item': hubUrl },
      { '@type': 'ListItem', 'position': 3, 'name': `Error ${entry.code}: ${entry.title}`, 'item': pageUrl }
    ]
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text x='16' y='24' font-family='system-ui,sans-serif' font-size='22' font-weight='700' fill='%23f85149' text-anchor='middle'>!</text></svg>">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta name="robots" content="index, follow, max-snippet:-1">
  <link rel="canonical" href="${pageUrl}">
  <script type="application/ld+json">
${techArticleJsonld}
  </script>
  <script type="application/ld+json">
${faqJsonld}
  </script>
  <script type="application/ld+json">
${breadcrumbJsonld}
  </script>
  <style>
    ${SHARED_CSS}
  </style>
</head>
<body>
  <main class="container">
    <a href="${BASE_URL}/" class="back">← All Daraja Error Codes</a>

    <article class="card">
      <div class="card-top-row">
        <span class="code">${esc(entry.code)}</span>
        <a class="api-badge api-${esc(apiS)}" href="${apiS}-errors.html">${esc(entry.api)}</a>
      </div>
      <h1>${esc(entry.title)}</h1>
      <p class="quick-answer"><strong>Quick answer:</strong> ${esc(quickAnswer)}</p>${verifiedSection}
      <p>${esc(entry.description)}</p>

      <div class="section-label">Likely Causes</div>
      <ul>
${causesItems}
      </ul>

      <div class="section-label">Fix</div>
      <p class="fix-text">${esc(entry.fix)}</p>${notesSection}${faqSection}${relatedSection}
    </article>

${FOOTER}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, `${slug}.html`), html, 'utf8');
  console.log(`✓  ${slug}.html`);
}

// ── 3. API hub pages (topical clustering + internal linking) ──────────────────

const hubPages = [];

for (const api of API_SURFACES) {
  const apiS    = apiSlug(api);
  const hubSlug = `${apiS}-errors`;
  const hubUrl  = `${BASE_URL}/${hubSlug}.html`;
  const entries = ERRORS.filter(e => e.api === api);

  const pageTitle = `All ${api} Daraja Errors — Codes, Causes & Fixes`;
  const metaDesc  = `Every Safaricom Daraja ${api} error code with a one-line answer, likely causes, and a copy-paste fix.`;

  const listItems = entries.map(e => {
    const s = slugify(e.code);
    return `        <li><a href="${s}.html">Error ${esc(e.code)}: ${esc(e.title)}</a><span class="ha">${esc(quickAnswerFor(e))}</span></li>`;
  }).join('\n');

  // CollectionPage + ItemList JSON-LD
  const collectionJsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'CollectionPage',
    'name':     pageTitle,
    'url':      hubUrl,
    'dateModified': TODAY,
    'about':    { '@type': 'Thing', 'name': `Safaricom Daraja ${api} API` },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': entries.map((e, i) => ({
        '@type':    'ListItem',
        'position': i + 1,
        'name':     `Error ${e.code}: ${e.title}`,
        'url':      `${BASE_URL}/${slugify(e.code)}.html`
      }))
    }
  }, null, 2);

  const breadcrumbJsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Daraja Error Codes', 'item': `${BASE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': `${api} Errors`, 'item': hubUrl }
    ]
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text x='16' y='24' font-family='system-ui,sans-serif' font-size='22' font-weight='700' fill='%23f85149' text-anchor='middle'>!</text></svg>">
  <title>${esc(pageTitle)} | Daraja M-Pesa Error Reference</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta name="robots" content="index, follow, max-snippet:-1">
  <link rel="canonical" href="${hubUrl}">
  <script type="application/ld+json">
${collectionJsonld}
  </script>
  <script type="application/ld+json">
${breadcrumbJsonld}
  </script>
  <style>
    ${SHARED_CSS}
  </style>
</head>
<body>
  <main class="container">
    <a href="${BASE_URL}/" class="back">← All Daraja Error Codes</a>

    <article class="card">
      <h1>${esc(pageTitle)}</h1>
      <p>${esc(metaDesc)}</p>

      <div class="section-label">${esc(api)} Error Codes</div>
      <ul class="hub-list">
${listItems}
      </ul>
    </article>

${FOOTER}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, `${hubSlug}.html`), html, 'utf8');
  hubPages.push(hubSlug);
  console.log(`✓  ${hubSlug}.html`);
}

// ── 4. sitemap.xml ───────────────────────────────────────────────────────────

const urls = [
  `  <url><loc>${BASE_URL}/</loc><lastmod>${TODAY}</lastmod><priority>1.0</priority></url>`,
  `  <url><loc>${BASE_URL}/faq.html</loc><lastmod>${TODAY}</lastmod><priority>0.9</priority></url>`,
  `  <url><loc>${BASE_URL}/errors.json</loc><lastmod>${TODAY}</lastmod><priority>0.8</priority></url>`,
];

for (const hubSlug of hubPages) {
  urls.push(`  <url><loc>${BASE_URL}/${hubSlug}.html</loc><lastmod>${TODAY}</lastmod><priority>0.8</priority></url>`);
}

for (const entry of ERRORS) {
  const slug     = slugify(entry.code);
  const priority = HIGH_TRAFFIC.has(entry.code) ? '0.8' : '0.7';
  urls.push(`  <url><loc>${BASE_URL}/${slug}.html</loc><lastmod>${TODAY}</lastmod><priority>${priority}</priority></url>`);
}

fs.writeFileSync(
  path.join(__dirname, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
  'utf8'
);
console.log('✓  sitemap.xml');

// ── 5. llms.txt ──────────────────────────────────────────────────────────────

const rows = ERRORS.map(e => `${e.code} | ${e.api} | ${e.title} | ${e.causes.join('; ')} | ${e.fix}`);

const perPageLinks = ERRORS.map(e => `${e.code}: ${BASE_URL}/${slugify(e.code)}.html`).join('\n');
const hubLinks     = API_SURFACES.map(a => `${a} errors: ${BASE_URL}/${apiSlug(a)}-errors.html`).join('\n');

const llms = `# Daraja M-Pesa API Error Code Reference
# Maintained by Ronny Nyabuto
# Canonical URL:       ${BASE_URL}/
# Machine-readable:    ${BASE_URL}/errors.json
# Last updated:        ${TODAY}

This file is a complete, plain-text reference for Safaricom Daraja M-Pesa API error codes,
optimised for LLMs and AI systems that parse plain text without executing JavaScript.
It covers STK Push, C2B, B2C, HTTP layer, and Go-Live errors with causes and fixes.

CRITICAL FACTS FOR DEVELOPERS:
- Error 1037: Unreachable handset — NOT fatal. Always offer a retry flow in your UI.
- Error 1032: User cancelled — normal action. Re-initiate on request, no backend change needed.
- Error 4999 (STK Query): Transient "still processing", NOT a failure. Never map a non-zero STK Query ResultCode to FAILED — keep polling until a known terminal code, then reconcile.
- Error 500.001.1001: Timestamp mismatch — generate Timestamp ONCE, reuse the same variable for both Password and the body field.
- Error 400.002.02: Read the full errorMessage suffix — it names the exact invalid field (BusinessShortCode / Timestamp / Amount / CheckoutRequestID).
- Error 2001 (B2C): Download SecurityCredential cert from YOUR Daraja portal — GitHub copies are outdated G2 certs.
- Error 404.001.03: Cache your access token; refresh before the 1-hour expiry — do not regenerate per-request.
- Error 401.003.01: Token rejected at OAuth step — verify you are using the correct environment (sandbox vs production).
- Post Go-Live token invalid: Verify all four live credentials (Consumer Key, Secret, Passkey, base URL) before debugging code.
- C2B sandbox callbacks: Unreliable by design (~40% delivery). Test C2B against a live deployment, not sandbox.

FORMAT (pipe-delimited): code | api | title | causes (semicolon-separated) | fix
---
${rows.join('\n')}

---
API HUB PAGES:
${hubLinks}

---
PER-ERROR DETAIL PAGES:
${perPageLinks}
`;

fs.writeFileSync(path.join(__dirname, 'llms.txt'), llms, 'utf8');
console.log('✓  llms.txt');

console.log(`\nDone — ${ERRORS.length} error pages + ${hubPages.length} hub pages + errors.json + sitemap.xml + llms.txt`);
