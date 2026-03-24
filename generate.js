#!/usr/bin/env node
/**
 * generate.js — Daraja Error Code Reference generator
 *
 * Reads errors.js (the single source of truth) and outputs:
 *   - errors.json    — machine-readable data for AI agents and tool callers
 *   - {slug}.html    — one standalone, indexable page per error code
 *   - sitemap.xml    — full sitemap with priority weights
 *   - llms.txt       — plain-text reference for LLMs that can only read text
 *
 * Run: node generate.js
 * Re-run every time errors.js changes.
 *
 * SEO features per page:
 *   - Title: "Error {code}: {title}" (code front-loaded, matches developer search queries)
 *   - <meta name="robots" content="index, follow, max-snippet:-1">
 *   - TechArticle JSON-LD with dateModified
 *   - BreadcrumbList JSON-LD (produces breadcrumb trail in Google SERPs)
 *   - Related Errors section (internal linking for PageRank distribution + topical clustering)
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

// High-traffic errors get sitemap priority 0.8; all others 0.7
const HIGH_TRAFFIC = new Set(['1037', '1032', '400.002.02', '500.001.1001', '2001', '404.001.03']);

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

// ── 1. errors.json ───────────────────────────────────────────────────────────

fs.writeFileSync(
  path.join(__dirname, 'errors.json'),
  JSON.stringify(ERRORS, null, 2),
  'utf8'
);
console.log('✓  errors.json');

// ── 2. Per-error HTML pages ──────────────────────────────────────────────────

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
    .api-go-live  { background: #e2d9f3; color: #4a235a; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #111; }
    p  { font-size: 14px; color: #444; margin: 0 0 8px; }
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
    .related-list { list-style: none; padding: 0; margin: 6px 0; }
    .related-list li { margin-bottom: 4px; }
    .related-list a { color: #0066ff; text-decoration: none; font-size: 14px; font-weight: 500; }
    .related-list a:hover { text-decoration: underline; }
    .page-footer { margin-top: 32px; font-size: 13px; color: #888; text-align: center; }
    .page-footer a { color: #0066ff; text-decoration: none; }
    .page-footer a:hover { text-decoration: underline; }
    @media (max-width: 600px) {
      .card-top-row { flex-direction: column; align-items: flex-start; }
      .code { font-size: 20px; }
    }
`.trim();

for (const entry of ERRORS) {
  const slug    = slugify(entry.code);
  const pageUrl = `${BASE_URL}/${slug}.html`;
  const apiSlug = entry.api.toLowerCase().replace(/\s+/g, '-');

  // Title: error code front-loaded — matches how developers search ("daraja error 1037")
  const pageTitle = `Error ${entry.code}: ${entry.title} | Daraja M-Pesa Error Reference`;

  const causesItems = entry.causes.map(c => `        <li>${esc(c)}</li>`).join('\n');

  const notesSection = entry.notes
    ? `\n      <div class="section-label">Notes</div>\n      <p class="notes-text">${esc(entry.notes)}</p>`
    : '';

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

  const metaDesc = `${entry.title}: ${entry.description}`.replace(/"/g, "'").slice(0, 155);

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

  // BreadcrumbList JSON-LD — produces breadcrumb trail in Google SERPs
  const breadcrumbJsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Daraja Error Codes',  'item': `${BASE_URL}/` },
      { '@type': 'ListItem', 'position': 2, 'name': `Error ${entry.code}: ${entry.title}`, 'item': pageUrl }
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
${breadcrumbJsonld}
  </script>
  <style>
    ${SHARED_CSS}
  </style>
</head>
<body>
  <div class="container">
    <a href="${BASE_URL}/" class="back">← All Daraja Error Codes</a>

    <div class="card">
      <div class="card-top-row">
        <span class="code">${esc(entry.code)}</span>
        <span class="api-badge api-${esc(apiSlug)}">${esc(entry.api)}</span>
      </div>
      <h1>${esc(entry.title)}</h1>
      <p>${esc(entry.description)}</p>

      <div class="section-label">Likely Causes</div>
      <ul>
${causesItems}
      </ul>

      <div class="section-label">Fix</div>
      <p class="fix-text">${esc(entry.fix)}</p>${notesSection}${relatedSection}
    </div>

    <p class="page-footer">
      Part of the <a href="${BASE_URL}/">Daraja Error Code Reference</a> —
      open source on <a href="https://github.com/ronnyabuto/daraja-error-codes" target="_blank" rel="noopener">GitHub</a>.
    </p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, `${slug}.html`), html, 'utf8');
  console.log(`✓  ${slug}.html`);
}

// ── 3. sitemap.xml ───────────────────────────────────────────────────────────

const urls = [
  `  <url><loc>${BASE_URL}/</loc><lastmod>${TODAY}</lastmod><priority>1.0</priority></url>`,
  `  <url><loc>${BASE_URL}/faq.html</loc><lastmod>${TODAY}</lastmod><priority>0.9</priority></url>`,
  `  <url><loc>${BASE_URL}/errors.json</loc><lastmod>${TODAY}</lastmod><priority>0.8</priority></url>`,
];

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

// ── 4. llms.txt ──────────────────────────────────────────────────────────────

const rows = ERRORS.map(e => `${e.code} | ${e.api} | ${e.title} | ${e.causes.join('; ')} | ${e.fix}`);

const perPageLinks = ERRORS.map(e => `${e.code}: ${BASE_URL}/${slugify(e.code)}.html`).join('\n');

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
- Error 500.001.1001: Timestamp mismatch — generate Timestamp ONCE, reuse the same variable for both Password and the body field.
- Error 400.002.02: Read the full errorMessage suffix — it names the exact invalid field (BusinessShortCode / Timestamp / Amount).
- Error 2001 (B2C): Download SecurityCredential cert from YOUR Daraja portal — GitHub copies are outdated G2 certs.
- Error 404.001.03: Cache your access token; refresh before the 1-hour expiry — do not regenerate per-request.
- Error 401.003.01: Token rejected at OAuth step — verify you are using the correct environment (sandbox vs production).
- Post Go-Live token invalid: Verify all four live credentials (Consumer Key, Secret, Passkey, base URL) before debugging code.
- C2B sandbox callbacks: Unreliable by design (~40% delivery). Test C2B against a live deployment, not sandbox.

FORMAT (pipe-delimited): code | api | title | causes (semicolon-separated) | fix
---
${rows.join('\n')}

---
PER-ERROR DETAIL PAGES:
${perPageLinks}
`;

fs.writeFileSync(path.join(__dirname, 'llms.txt'), llms, 'utf8');
console.log('✓  llms.txt');

console.log(`\nDone — ${ERRORS.length} error pages + errors.json + sitemap.xml + llms.txt`);
