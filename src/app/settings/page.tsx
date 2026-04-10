'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Fund } from '@/types';
import { FundManager } from '@/components/FundManager';

export default function SettingsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunds = useCallback(async () => {
    const res = await fetch('/api/funds');
    const data: Fund[] = await res.json();
    setFunds(data);
  }, []);

  useEffect(() => {
    fetchFunds().finally(() => setLoading(false));
  }, [fetchFunds]);

  async function handleAdd(name: string, url: string) {
    const res = await fetch('/api/funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to add fund');
    }
    await fetchFunds();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/funds/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to remove fund');
    await fetchFunds();
  }

  async function handleRefresh(id: string) {
    const res = await fetch(`/api/scrape/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error('Scrape failed');
    await fetchFunds();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Add PE funds to track, trigger manual scrapes, and inspect scrape logs.
        </p>
      </div>

      {/* Status summary for flagged funds */}
      {!loading && funds.some((f) => f.lastScrapeStatus === 'error' || f.lastScrapeStatus === 'warning') && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>⚠ Attention required:</strong>{' '}
          {funds.filter((f) => f.lastScrapeStatus !== 'success' && f.lastScrapeStatus !== null).length} fund(s)
          have scrape issues — see details below.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <FundManager
          funds={funds}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
