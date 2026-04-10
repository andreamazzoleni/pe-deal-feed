export interface Fund {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  lastScrapeAt: string | null;
  lastScrapeStatus: 'success' | 'warning' | 'error' | null;
  lastScrapeMessage: string | null;
}

export interface Article {
  id: string;
  fundId: string;
  headline: string;
  url: string;
  date: string | null;
  summary: string | null;
  createdAt: string;
  fund: { name: string };
}

export interface ScrapeLog {
  id: string;
  fundId: string;
  timestamp: string;
  itemsExtracted: number;
  status: 'success' | 'warning' | 'error';
  errorMessage: string | null;
}

export interface ScrapeResult {
  articles: ScrapedArticle[];
  status: 'success' | 'warning' | 'error';
  itemsExtracted: number;
  errorMessage?: string;
}

export interface ScrapedArticle {
  headline: string;
  url: string;
  date: Date | null;
  summary: string | null;
}
