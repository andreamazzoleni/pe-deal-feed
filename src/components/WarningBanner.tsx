'use client';

import type { Fund } from '@/types';

interface Props {
  funds: Fund[];
}

export function WarningBanner({ funds }: Props) {
  const flagged = funds.filter(
    (f) => f.lastScrapeStatus === 'warning' || f.lastScrapeStatus === 'error',
  );
  if (flagged.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {flagged.map((f) => (
        <div
          key={f.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            f.lastScrapeStatus === 'error'
              ? 'border-red-300 bg-red-50 text-red-800'
              : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
        >
          <span className="text-lg leading-none mt-0.5">
            {f.lastScrapeStatus === 'error' ? '🔴' : '⚠️'}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{f.name}</span>
            {' — '}
            {f.lastScrapeMessage ?? 'Scrape issue detected.'}
            {f.lastScrapeAt && (
              <span className="ml-2 opacity-70 text-xs">
                (last attempt:{' '}
                {new Date(f.lastScrapeAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                )
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
