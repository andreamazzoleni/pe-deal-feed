'use client';

import type { ScrapeLog } from '@/types';

interface Props {
  logs: ScrapeLog[];
  loading: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-50 text-green-700 border border-green-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  error: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_ICONS: Record<string, string> = {
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function ScrapeLogTable({ logs, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-gray-400 py-2">Loading logs…</p>;
  }
  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 py-2">No scrape attempts recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-1.5 pr-4 font-medium">Time</th>
            <th className="py-1.5 pr-4 font-medium">Status</th>
            <th className="py-1.5 pr-4 font-medium">Items</th>
            <th className="py-1.5 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="py-1.5 pr-4">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-xs ${STATUS_STYLES[log.status] ?? ''}`}
                >
                  {STATUS_ICONS[log.status]} {log.status}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-gray-700 font-mono">{log.itemsExtracted}</td>
              <td className="py-1.5 text-gray-500 max-w-xs truncate">
                {log.errorMessage ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
