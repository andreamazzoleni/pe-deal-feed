import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { ScrapedArticle, ScrapeResult } from '@/types';

const MAX_PAGES = 40; // cap at 40 pages per fund

// Keywords that indicate an error/access-denied page
const ERROR_KEYWORDS = [
  '403 forbidden',
  'access denied',
  'access-denied',
  'captcha',
  'are you a robot',
  'bot detected',
  'enable javascript',
  'javascript is required',
  'cloudflare',
  'ddos protection',
  'too many requests',
  '429 too many',
  '503 service unavailable',
  'just a moment',
];

// Ordered list of CSS selectors to try for finding article containers
const ARTICLE_CONTAINER_SELECTORS = [
  'article',
  '[class*="news-item"]',
  '[class*="article-item"]',
  '[class*="news-card"]',
  '[class*="article-card"]',
  '[class*="press-release"]',
  '[class*="press-item"]',
  '[class*="media-item"]',
  '[class*="post-item"]',
  '[class*="story-item"]',
  '[class*="release-item"]',
  '.news-item',
  '.article-item',
  '.press-item',
  '.post-item',
  '.media-item',
  '.news-list-item',
  'li.news',
  'li.article',
  'li.post',
];

const HEADING_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5',
  '.title', '.headline',
  '[class*="title"]',
  '[class*="headline"]',
];

const DATE_SELECTORS = [
  'time',
  '.date', '.datetime',
  '[class*="date"]',
  '[class*="time"]',
  '[datetime]',
  'span[class*="posted"]',
  'span[class*="published"]',
];

const SUMMARY_SELECTORS = [
  '.excerpt', '.summary', '.description', '.teaser', '.intro',
  '[class*="excerpt"]',
  '[class*="summary"]',
  '[class*="description"]',
  '[class*="teaser"]',
  'p',
];

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const direct = new Date(s);
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) return direct;

  const patterns: RegExp[] = [
    /(\w{3,9}\s+\d{1,2},?\s+\d{4})/,
    /(\d{1,2}\s+\w{3,9}\s+\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\.\d{1,2}\.\d{4})/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
    }
  }

  return null;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    if (href.startsWith('http')) return href;
    const base = new URL(baseUrl);
    return new URL(href, base.origin).href;
  } catch {
    return href;
  }
}

function checkForErrorPage(html: string): string | null {
  const snippet = html.slice(0, 8000).toLowerCase();
  for (const kw of ERROR_KEYWORDS) {
    if (snippet.includes(kw)) {
      return `Page contains error indicator: "${kw}"`;
    }
  }
  return null;
}

/**
 * Find the URL of the next paginated page, or null if this is the last page.
 * Checks (in order of reliability):
 *   1. <link rel="next"> in <head>  — standard SEO pagination (WordPress, etc.)
 *   2. <a rel="next">               — in-body rel attribute
 *   3. <a> with "next page" aria-label or title
 *   4. <a> whose visible text is a common "next" label (Next, ›, », →, Load more)
 */
function findNextPageUrl(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);

  // 1. <link rel="next">
  const linkNext = $('link[rel="next"]').attr('href');
  if (linkNext) return resolveUrl(linkNext, currentUrl);

  // 2. <a rel="next">
  const aNext = $('a[rel="next"]').first().attr('href');
  if (aNext) return resolveUrl(aNext, currentUrl);

  // 3. aria-label / title containing "next page"
  for (const sel of ['a[aria-label*="next" i]', 'a[title*="next page" i]']) {
    const $el = $(sel).not('[aria-label*="previous" i]').not('[aria-label*="prev" i]').first();
    if ($el.length) {
      const href = $el.attr('href');
      if (href && href !== currentUrl) return resolveUrl(href, currentUrl);
    }
  }

  // 4. Visible text: "Next", "Next page", "Load more", ›, », →
  const $nextLink = $('a[href]').filter((_, el) => {
    const $a = $(el);
    const text = $a.text().trim();
    const cls = ($a.attr('class') ?? '').toLowerCase();
    return (
      /^(next|next\s+page|load\s+more|›|»|→|>)$/i.test(text) &&
      !cls.includes('prev') &&
      !cls.includes('back')
    );
  }).first();

  if ($nextLink.length) {
    const href = $nextLink.attr('href');
    if (href && href !== currentUrl) return resolveUrl(href, currentUrl);
  }

  return null;
}

/**
 * Extract overlay-link headline+url from a card container.
 * Handles the pattern where a <a aria-label="View …"> is absolutely positioned
 * over the card and the visible title sits in a plain <div> (not a heading).
 */
function extractOverlayLink(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>,
  baseUrl: string,
  seen: Set<string>,
): { headline: string; url: string } | null {
  const $a = $el.find('a[aria-label]').filter((_, a) => {
    const label = $(a).attr('aria-label') ?? '';
    return label.length > 10 && !/^(search|menu|close|open|toggle|navigate|go to)/i.test(label);
  }).first();

  if (!$a.length) return null;

  const rawLabel = $a.attr('aria-label') ?? '';
  const headline = rawLabel.replace(/^(?:View|Read|Go to)\s+/i, '').trim();
  if (headline.length < 10) return null;

  const rawHref = $a.attr('href') ?? '';
  if (!rawHref || rawHref === '#') return null;

  const url = resolveUrl(rawHref, baseUrl);
  if (seen.has(url)) return null;

  return { headline, url };
}

export function extractArticlesFromHTML(html: string, baseUrl: string): ScrapedArticle[] {
  const $ = cheerio.load(html);
  const results: ScrapedArticle[] = [];
  const seen = new Set<string>();

  // ── Strategy 1: explicit article container selectors ──────────────────────
  // Run all selectors and keep whichever yields the most articles.
  let bestResults: ScrapedArticle[] = [];

  for (const sel of ARTICLE_CONTAINER_SELECTORS) {
    const elements = $(sel);
    const minCount = sel === 'article' ? 1 : 2;
    if (elements.length < minCount) continue;

    const candidateResults: ScrapedArticle[] = [];
    const candidateSeen = new Set<string>(seen);

    elements.each((_, el) => {
      const $el = $(el);

      let headline = '';
      let url = '';

      const $heading = $el.find(HEADING_SELECTORS.join(', ')).first();
      const $link = $el.find('a[href]').first();

      if ($heading.length && $link.length) {
        headline = $heading.text().trim();
        const rawHref = $link.attr('href') ?? '';
        if (!rawHref || rawHref === '#') return;
        url = resolveUrl(rawHref, baseUrl);
      } else {
        // Overlay link pattern (e.g. Cinven)
        const overlay = extractOverlayLink($, $el, baseUrl, candidateSeen);
        if (!overlay) return;
        ({ headline, url } = overlay);
      }

      if (!headline || headline.length < 10 || headline.length > 400) return;
      if (!url.startsWith('http')) return;
      if (candidateSeen.has(url)) return;
      candidateSeen.add(url);

      const $dateEl = $el.find(DATE_SELECTORS.join(', ')).first();
      const dateStr = $dateEl.attr('datetime') ?? $dateEl.text().trim();

      const $summaryEl = $el.find(SUMMARY_SELECTORS.join(', ')).first();
      let summary = $summaryEl.text().trim() || null;
      if (summary === headline) summary = null;
      if (summary && summary.length > 320) summary = summary.slice(0, 320) + '…';

      candidateResults.push({ headline, url, date: parseDate(dateStr), summary });
    });

    if (candidateResults.length > bestResults.length) {
      bestResults = candidateResults;
    }
    if (bestResults.length >= 10) break;
  }

  if (bestResults.length > 0) {
    bestResults.forEach((r) => { results.push(r); seen.add(r.url); });
  }

  // ── Strategy 2: links wrapping a heading element ──────────────────────────
  if (results.length < 3) {
    $('a[href]').each((_, el) => {
      const $a = $(el);
      const $heading = $a.find(HEADING_SELECTORS.join(', ')).first();
      if (!$heading.length) return;

      const headline = $heading.text().trim();
      const rawHref = $a.attr('href') ?? '';
      if (!headline || !rawHref || rawHref === '#') return;

      const url = resolveUrl(rawHref, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const $container = $a.closest('article, li, section, div');
      const $dateEl = $container.find(DATE_SELECTORS.join(', ')).first();
      const dateStr = $dateEl.attr('datetime') ?? $dateEl.text().trim();

      const $summaryEl = $container.find('p').first();
      let summary = $summaryEl.text().trim() || null;
      if (summary === headline) summary = null;
      if (summary && summary.length > 320) summary = summary.slice(0, 320) + '…';

      results.push({ headline, url, date: parseDate(dateStr), summary });
    });
  }

  // ── Strategy 3: headings that are links or contain links ──────────────────
  if (results.length < 3) {
    $(HEADING_SELECTORS.join(', ')).each((_, el) => {
      const $h = $(el);
      const $a = $h.find('a[href]').first();
      const rawHref = $a.attr('href') ?? $h.closest('a').attr('href') ?? '';
      const headline = $h.text().trim();
      if (!headline || !rawHref || rawHref === '#') return;

      const url = resolveUrl(rawHref, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const $container = $h.closest('article, li, section, div');
      const $dateEl = $container.find(DATE_SELECTORS.join(', ')).first();
      const dateStr = $dateEl.attr('datetime') ?? $dateEl.text().trim();

      results.push({ headline, url, date: parseDate(dateStr), summary: null });
    });
  }

  // ── Strategy 4: aria-label overlay links (no container match) ────────────
  if (results.length < 3) {
    $('a[aria-label]').each((_, el) => {
      const $a = $(el);
      const rawLabel = $a.attr('aria-label') ?? '';
      if (/^(search|menu|close|open|toggle|navigate|go to)/i.test(rawLabel)) return;

      const headline = rawLabel.replace(/^(?:View|Read|Go to)\s+/i, '').trim();
      if (headline.length < 10 || headline.length > 400) return;

      const rawHref = $a.attr('href') ?? '';
      if (!rawHref || rawHref === '#') return;

      const url = resolveUrl(rawHref, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const $container = $a.closest('[class*="card"], [class*="item"], article, li, section');
      const $dateEl = $container.find(DATE_SELECTORS.join(', ')).first();
      const dateStr = $dateEl.attr('datetime') ?? $dateEl.text().trim();

      results.push({ headline, url, date: parseDate(dateStr), summary: null });
    });
  }

  return results.filter((a) => {
    if (a.headline.length < 10 || a.headline.length > 400) return false;
    if (!a.url.startsWith('http')) return false;
    return true;
  });
}

async function scrapeWithPlaywright(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    return { html, ok: response?.ok() ?? false, status: response?.status() ?? 0 };
  } finally {
    await browser.close();
  }
}

async function scrapeWithFetch(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(20000),
  });
  const html = await response.text();
  return { html, ok: response.ok, status: response.status };
}

export async function scrape(fundUrl: string, previousAverageCount?: number): Promise<ScrapeResult> {
  // ── Page 1: Playwright for full JS rendering ─────────────────────────────
  let firstHtml = '';
  let playwrightError: string | undefined;

  try {
    const result = await scrapeWithPlaywright(fundUrl);
    if (!result.ok) {
      return {
        articles: [],
        status: 'error',
        itemsExtracted: 0,
        errorMessage: `HTTP ${result.status} returned by ${fundUrl}`,
      };
    }
    firstHtml = result.html;
  } catch (err) {
    playwrightError = err instanceof Error ? err.message : String(err);

    if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ENOTFOUND|ETIMEDOUT/.test(playwrightError)) {
      return {
        articles: [],
        status: 'error',
        itemsExtracted: 0,
        errorMessage: `Network error: ${playwrightError}`,
      };
    }

    try {
      const result = await scrapeWithFetch(fundUrl);
      if (!result.ok) {
        return {
          articles: [],
          status: 'error',
          itemsExtracted: 0,
          errorMessage: `HTTP ${result.status} (fetch fallback) for ${fundUrl}`,
        };
      }
      firstHtml = result.html;
    } catch (fetchErr) {
      return {
        articles: [],
        status: 'error',
        itemsExtracted: 0,
        errorMessage: `Playwright: ${playwrightError} | Fetch fallback: ${
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        }`,
      };
    }
  }

  const contentError = checkForErrorPage(firstHtml);
  if (contentError) {
    return { articles: [], status: 'error', itemsExtracted: 0, errorMessage: contentError };
  }

  // ── Collect articles across all pages ────────────────────────────────────
  const seenUrls = new Set<string>();
  const allArticles: ScrapedArticle[] = [];

  function addPage(html: string) {
    for (const a of extractArticlesFromHTML(html, fundUrl)) {
      if (!seenUrls.has(a.url)) {
        seenUrls.add(a.url);
        allArticles.push(a);
      }
    }
  }

  addPage(firstHtml);

  // ── Pagination: plain fetch for pages 2+ (much faster than Playwright) ───
  let currentHtml = firstHtml;
  let currentUrl = fundUrl;
  const visitedUrls = new Set<string>([fundUrl]);

  for (let page = 2; page <= MAX_PAGES; page++) {
    const nextUrl = findNextPageUrl(currentHtml, currentUrl);
    if (!nextUrl || visitedUrls.has(nextUrl)) break;

    visitedUrls.add(nextUrl);

    try {
      const result = await scrapeWithFetch(nextUrl);
      if (!result.ok) break;

      const prevCount = allArticles.length;
      currentHtml = result.html;
      currentUrl = nextUrl;
      addPage(currentHtml);

      // If a page added nothing new, we've likely looped back or hit the end
      if (allArticles.length === prevCount) break;
    } catch {
      break;
    }
  }

  const count = allArticles.length;

  if (count === 0) {
    return {
      articles: [],
      status: 'warning',
      itemsExtracted: 0,
      errorMessage:
        'No articles could be extracted. The page structure may be unsupported — check the URL or try a more specific news/press-releases sub-page.',
    };
  }

  if (previousAverageCount && previousAverageCount > 0 && count < previousAverageCount * 0.5) {
    return {
      articles: allArticles,
      status: 'warning',
      itemsExtracted: count,
      errorMessage: `Only ${count} articles extracted vs. historical average of ~${Math.round(
        previousAverageCount,
      )}. The page structure may have changed.`,
    };
  }

  return { articles: allArticles, status: 'success', itemsExtracted: count };
}
