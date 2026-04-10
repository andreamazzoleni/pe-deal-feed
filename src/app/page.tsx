'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article, Fund } from '@/types';
import { ArticleCard } from '@/components/ArticleCard';
import { FilterBar } from '@/components/FilterBar';
import { WarningBanner } from '@/components/WarningBanner';

export default function FeedPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedFundId, setSelectedFundId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [keyword, setKeyword] = useState('');

  const autoRefreshDone = useRef(false);

  const fetchFunds = useCallback(async () => {
    const res = await fetch('/api/funds');
    const data: Fund[] = await res.json();
    setFunds(data);
    return data;
  }, []);

  const fetchArticles = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedFundId) params.set('fundId', selectedFundId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (keyword) params.set('keyword', keyword);

    const res = await fetch(`/api/articles?${params.toString()}`);
    const data: Article[] = await res.json();
    setArticles(data);
  }, [selectedFundId, dateFrom, dateTo, keyword]);

  // Trigger scrape for a single fund, then refresh state
  const scrapeFund = useCallback(async (fundId: string) => {
    await fetch(`/api/scrape/${fundId}`, { method: 'POST' });
  }, []);

  // Auto-refresh: scrape funds that haven't been scraped in 24h
  useEffect(() => {
    if (autoRefreshDone.current) return;
    autoRefreshDone.current = true;

    (async () => {
      try {
        const res = await fetch('/api/auto-refresh');
        const { fundsToRefresh } = await res.json() as { fundsToRefresh: { id: string; name: string }[] };
        if (fundsToRefresh.length > 0) {
          // Scrape in background — fire and don't block the UI
          Promise.allSettled(fundsToRefresh.map((f) => scrapeFund(f.id))).then(async () => {
            await fetchFunds();
            await fetchArticles();
          });
        }
      } catch {
        // Non-critical — ignore auto-refresh errors
      }
    })();
  }, [scrapeFund, fetchFunds, fetchArticles]);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchFunds(), fetchArticles()]);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch articles when filters change
  useEffect(() => {
    if (!loading) fetchArticles();
  }, [selectedFundId, dateFrom, dateTo, keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      await fetch('/api/scrape/all', { method: 'POST' });
      await fetchFunds();
      await fetchArticles();
    } finally {
      setRefreshing(false);
    }
  }

  function handleClear() {
    setSelectedFundId('');
    setDateFrom('');
    setDateTo('');
    setKeyword('');
  }

  const flaggedFunds = funds.filter(
    (f) => f.lastScrapeStatus === 'warning' || f.lastScrapeStatus === 'error',
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {articles.length > 0
              ? `${articles.length} articles from ${funds.length} fund${funds.length !== 1 ? 's' : ''}`
              : funds.length === 0
              ? 'No funds configured — go to Settings to add some.'
              : 'No articles yet — refresh a fund to start.'}
          </p>
        </div>
      </div>

      {/* Warning banners — always at the top, never buried */}
      {flaggedFunds.length > 0 && <WarningBanner funds={flaggedFunds} />}

      {funds.length > 0 && (
        <FilterBar
          funds={funds}
          selectedFundId={selectedFundId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          keyword={keyword}
          loading={refreshing}
          onFundChange={setSelectedFundId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onKeywordChange={setKeyword}
          onRefreshAll={handleRefreshAll}
          onClear={handleClear}
        />
      )}

      {/* Article list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 && funds.length > 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📰</p>
          <p className="font-medium text-gray-500">No articles match your filters.</p>
          <p className="text-sm mt-1">Try hitting <strong>Refresh All</strong> or adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
