'use client';

import { useState } from 'react';
import type { Fund, ScrapeLog } from '@/types';
import { ScrapeLogTable } from './ScrapeLogTable';

interface Props {
  funds: Fund[];
  onAdd: (name: string, url: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: (id: string) => Promise<void>;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  success: { label: '✓ OK', cls: 'bg-green-50 text-green-700 border border-green-200' },
  warning: { label: '⚠ Warning', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  error: { label: '✕ Error', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">Never scraped</span>;
  const b = STATUS_BADGE[status];
  if (!b) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
      {b.label}
    </span>
  );
}

export function FundManager({ funds, onAdd, onDelete, onRefresh }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logCache, setLogCache] = useState<Record<string, ScrapeLog[]>>({});
  const [logLoading, setLogLoading] = useState<Record<string, boolean>>({});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!name.trim() || !url.trim()) {
      setAddError('Both fields are required.');
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setAddError('Please enter a valid URL (include https://).');
      return;
    }
    setAdding(true);
    try {
      await onAdd(name.trim(), url.trim());
      setName('');
      setUrl('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add fund.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRefresh(id: string) {
    setRefreshingId(id);
    try {
      await onRefresh(id);
      // Invalidate log cache so it reloads on next expand
      setLogCache((c) => { const n = { ...c }; delete n[id]; return n; });
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this fund and all its cached articles?')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleLogs(fundId: string) {
    if (expandedLogId === fundId) {
      setExpandedLogId(null);
      return;
    }
    setExpandedLogId(fundId);
    if (!logCache[fundId]) {
      setLogLoading((l) => ({ ...l, [fundId]: true }));
      try {
        const res = await fetch(`/api/logs/${fundId}`);
        const data: ScrapeLog[] = await res.json();
        setLogCache((c) => ({ ...c, [fundId]: data }));
      } finally {
        setLogLoading((l) => ({ ...l, [fundId]: false }));
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Add fund form */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Add a new fund</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KKR"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex-[2] min-w-[260px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">News / deals page URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.kkr.com/news"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding…' : 'Add fund'}
          </button>
        </form>
        {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
      </div>

      {/* Fund list */}
      <div className="space-y-3">
        {funds.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            No funds added yet. Use the form above to get started.
          </p>
        )}
        {funds.map((fund) => (
          <div
            key={fund.id}
            className={`bg-white rounded-lg border px-5 py-4 transition-colors ${
              fund.lastScrapeStatus === 'error'
                ? 'border-red-200'
                : fund.lastScrapeStatus === 'warning'
                ? 'border-amber-200'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{fund.name}</span>
                  <StatusBadge status={fund.lastScrapeStatus} />
                </div>
                <a
                  href={fund.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 truncate block mt-0.5"
                >
                  {fund.url}
                </a>
                {(fund.lastScrapeStatus === 'warning' || fund.lastScrapeStatus === 'error') &&
                  fund.lastScrapeMessage && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      ⚠ {fund.lastScrapeMessage}
                    </p>
                  )}
                {fund.lastScrapeAt && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    Last scraped:{' '}
                    {new Date(fund.lastScrapeAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleLogs(fund.id)}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {expandedLogId === fund.id ? 'Hide logs' : 'View logs'}
                </button>
                <button
                  onClick={() => handleRefresh(fund.id)}
                  disabled={refreshingId === fund.id}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  {refreshingId === fund.id ? 'Scraping…' : 'Refresh'}
                </button>
                <button
                  onClick={() => handleDelete(fund.id)}
                  disabled={deletingId === fund.id}
                  className="rounded-md border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {deletingId === fund.id ? '…' : 'Remove'}
                </button>
              </div>
            </div>

            {/* Expandable log section */}
            {expandedLogId === fund.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Scrape history (last 25 attempts)
                </h3>
                <ScrapeLogTable
                  logs={logCache[fund.id] ?? []}
                  loading={logLoading[fund.id] ?? false}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
