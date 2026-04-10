'use client';

import type { Fund } from '@/types';

interface Props {
  funds: Fund[];
  selectedFundId: string;
  dateFrom: string;
  dateTo: string;
  keyword: string;
  loading: boolean;
  onFundChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
  onRefreshAll: () => void;
  onClear: () => void;
}

export function FilterBar({
  funds,
  selectedFundId,
  dateFrom,
  dateTo,
  keyword,
  loading,
  onFundChange,
  onDateFromChange,
  onDateToChange,
  onKeywordChange,
  onRefreshAll,
  onClear,
}: Props) {
  const hasFilters = selectedFundId || dateFrom || dateTo || keyword;

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-end">
      {/* Keyword search */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Search headlines</label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="e.g. acquisition, energy…"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Fund filter */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Fund</label>
        <select
          value={selectedFundId}
          onChange={(e) => onFundChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        >
          <option value="">All funds</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Date to */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Actions */}
      <div className="flex items-end gap-2 ml-auto">
        {hasFilters && (
          <button
            onClick={onClear}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
        <button
          onClick={onRefreshAll}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Refreshing…' : 'Refresh All'}
        </button>
      </div>
    </div>
  );
}
