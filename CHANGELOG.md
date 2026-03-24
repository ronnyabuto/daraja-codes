# Changelog

All notable changes to the Daraja M-Pesa Error Code Reference are documented here.

---

## [1.3.0] — 2026-03-24

### Added — GEO (Generative Engine Optimization)

The reference is now fully accessible to AI systems (ChatGPT, Claude, Perplexity) and
developer tools (Copilot, Cursor) without requiring JavaScript execution or browser rendering.

**`errors.json`** — Static machine-readable data endpoint at a stable URL. The source data
(`errors.js`) was only accessible by running JavaScript in a browser. AI agents and
tool-calling systems can now fetch the full error database directly.

**Per-error HTML pages** (`1037.html`, `400.002.02.html`, `500.001.1001.html`, etc.) — Each
of the 15 documented error codes now has its own standalone, indexable URL. Hash anchors
(`index.html#1037`) are not independently indexed by search engines or AI crawlers — they
resolve to the same document. Standalone pages are indexed individually, and each carries its
own `<title>`, `<meta description>`, canonical link, and TechArticle JSON-LD.

**`faq.html`** — FAQ page with 15 Q&A pairs, written in the exact question form developers
type into search and AI prompts ("What does error 1037 mean?", "Why is my token invalid after
going live?"). FAQPage JSON-LD schema encodes the Q&A for schema parsers used by AI training
pipelines and retrieval systems.

**`robots.txt`** — Explicit `Allow: /` for all known AI crawler user agents: GPTBot,
OAI-SearchBot, ChatGPT-User (OpenAI); ClaudeBot, Claude-User, Claude-SearchBot (Anthropic);
PerplexityBot (Perplexity). Includes `Sitemap:` directive.

**`sitemap.xml`** — Generated programmatically with priority weights. 1.0 for the main index,
0.9 for the FAQ, 0.8 for the machine-readable JSON endpoint and high-traffic error pages
(1037, 1032, 400.002.02, 500.001.1001, 2001, 404.001.03), 0.7 for all other per-code pages.

**`llms.txt`** — Plain-text structured reference following the emerging llms.txt convention
(proposed by Jeremy Howard / Answer.AI). Designed for LLMs that can only read plain text —
includes critical integration facts, a complete pipe-delimited data dump, and links to every
per-error page.

**`exceptions.py`** — Python exception classes with module and class docstrings that surface
the reference URL, the 6 most common integration mistakes, and per-error page links. AI coding
assistants (Copilot, Cursor, Claude) index public repositories — these docstrings surface
inline as developers write Daraja integrations. Includes a `from_result()` factory that maps
raw result codes to the most specific exception subclass.

**`generate.js`** — Generator script that produces all programmatic outputs (`errors.json`,
per-error HTML pages, `sitemap.xml`, `llms.txt`) from the single source of truth (`errors.js`).
Run `node generate.js` after every data change to prevent drift.

---

## [1.2.0] — 2026-03-24

### Added — Fuzzy search with inline match highlighting

Replaced the `indexOf` substring search with Fuse.js (Bitap algorithm). The previous search
had no typo tolerance — "cancled" returned nothing. Fuse.js with `threshold: 0.35` and
`ignoreLocation: true` handles transpositions and partial matches across all fields
simultaneously, ranked by relevance.

Key configuration: `code` is weighted 3.0 (searching "1037" surfaces the right card first),
`title` 2.0, `api` and `description` 1.5, `causes` and `fix` 1.0, `notes` 0.8.

`includeMatches: true` provides character-level match indices. Matched text is highlighted
inline using `<mark>` tags via `applyHighlight()` — the function handles both scalar fields
and array fields (each `causes` item can be independently highlighted using `refIndex`).
Developers see exactly why a result appeared.

Result count indicator ("3 of 15 errors") shown when a query or category filter is active.

### Fixed

- Category filter was using `e.category` instead of `e.api` — filter buttons were silently
  returning empty results for every category.
- Raw error data was being interpolated into `innerHTML` without HTML-escaping — potential XSS
  surface. Existing `escapeHtml()` guard restored and applied to all fields.

---

## [1.1.0] — 2026-03-20

### Added

Error 401.003.01 (Invalid Access Token — OAuth Step): documented as distinct from 404.001.03.
Both relate to token problems but fire at different layers — 401.003.01 at the OAuth
authorization step, 404.001.03 during normal API calls with an expired token. Root causes
differ; both are fixed the same way (regenerate and retry).

Error 500.001.1001: expanded to document both root causes under the same code — Wrong
credentials (Timestamp mismatch) and Merchant does not exist (unregistered shortcode).

---

## [1.0.0] — 2026-03-20

### Added

Initial launch with 13 confirmed Daraja M-Pesa API errors covering STK Push, C2B, B2C,
HTTP layer, and Go-Live errors. Each entry includes: error code, API surface, title,
description, likely causes, recommended fix, and optional notes. Searchable single-page app
with substring search and category filter. Responsive card layout with API-specific
color-coded badges. Open Graph / Twitter Card meta, TechArticle structured data, and a
dynamic error count driven by the `ERRORS` array.
