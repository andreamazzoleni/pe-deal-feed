import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { ScrapedArticle, ScrapeResult } from '@/types';

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

  // Direct parse (ISO 8601, RFC 2822, etc.)
  const direct = new Date(s);
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) return direct;

  // Named month patterns
  const patterns: RegExp[] = [
    /(\w{3,9}\s+\d{1,2},?\s+\d{4})/,   // "April 1, 2024" / "Apr 1 2024"
    /(\d{1,2}\s+\w{3,9}\s+\d{4})/,     // "1 April 2024"
    /(\d{4}-\d{2}-\d{2})/,             // "2024-04-01"
    /(\d{1,2}\/\d{1,2}\/\d{4})/,       // "04/01/2024"
    /(\d{1,2}\.\d{1,2}\.\d{4})/,       // "01.04.2024"
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

export function extractArticlesFromHTML(html: string, baseUrl: string): ScrapedArticle[] {
  const $ = cheerio.load(html);
  const results: ScrapedArticle[] = [];
  const seen = new Set<string>();

  // Strategy 1: explicit article container selectors
  for (const sel of ARTICLE_CONTAINER_SELECTORS) {
    const elements = $(sel);
    if (elements.length < 2) continue;

    elements.each((_, el) => {
      const $el = $(el);

      const $link = $el.find('a[href]').first();
      const $heading = $el.find(HEADING_SELECTORS.join(', ')).first();
      if (!$heading.length || !$link.length) return;

      const headline = $heading.text().trim();
      const rawHref = $link.attr('href') ?? '';
      if (!headline || !rawHref || rawHref === '#') return;

      const url = resolveUrl(rawHref, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const $dateEl = $el.find(DATE_SELECTORS.join(', ')).first();
      const dateStr = $dateEl.attr('datetime') ?? $dateEl.text().trim();

      const $summaryEl = $el.find(SUMMARY_SELECTORS.join(', ')).first();
      let summary = $summaryEl.text().trim() || null;
      if (summary === headline) summary = null;
      if (summary && summary.length > 320) summary = summary.slice(0, 320) + '…';

      results.push({ headline, url, date: parseDate(dateStr), summary });
    });

    if (results.length >= 3) break;
  }

  // Strategy 2: find links that contain a heading element
  if (results.length < 2) {
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

  // Strategy 3: headings that are links themselves (common on simple press-release lists)
  if (results.length < 2) {
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

  // Deduplicate by headline similarity, remove nav/footer noise
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
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 35000,
    });
    // Extra wait for lazy-loaded content
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
  let html = '';
  let playwrightError: string | undefined;

  // --- Attempt 1: Playwright ---
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
    html = result.html;
  } catch (err) {
    playwrightError = err instanceof Error ? err.message : String(err);

    // If it looks like an HTTP-level error, bail immediately
    if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ENOTFOUND|ETIMEDOUT/.test(playwrightError)) {
      return {
        articles: [],
        status: 'error',
        itemsExtracted: 0,
        errorMessage: `Network error: ${playwrightError}`,
      };
    }

    // --- Attempt 2: plain fetch fallback ---
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
      html = result.html;
    } catch (fetchErr) {
      return {
        articles: [],
        status: 'error',
        itemsExtracted: 0,
        errorMessage: `Playwright: ${playwrightError} | Fetch fallback: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
      };
    }
  }

  // --- Error page detection ---
  const contentError = checkForErrorPage(html);
  if (contentError) {
    return { articles: [], status: 'error', itemsExtracted: 0, errorMessage: contentError };
  }

  // --- Article extraction ---
  const articles = extractArticlesFromHTML(html, fundUrl);
  const count = articles.length;

  if (count === 0) {
    return {
      articles: [],
      status: 'warning',
      itemsExtracted: 0,
      errorMessage:
        'No articles could be extracted. The page structure may be unsupported — check the URL or try a more specific news/press-releases sub-page.',
    };
  }

  // --- Volume anomaly check ---
  if (previousAverageCount && previousAverageCount > 0 && count < previousAverageCount * 0.5) {
    return {
      articles,
      status: 'warning',
      itemsExtracted: count,
      errorMessage: `Only ${count} articles extracted vs. historical average of ~${Math.round(previousAverageCount)}. The page structure may have changed.`,
    };
  }

  return { articles, status: 'success', itemsExtracted: count };
}
