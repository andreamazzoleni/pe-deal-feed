'use client';

import type { Article } from '@/types';

interface Props {
  article: Article;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ArticleCard({ article }: Props) {
  const date = formatDate(article.date);

  return (
    <div className="group bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-blue-700 leading-snug line-clamp-2 transition-colors"
          >
            {article.headline}
          </a>
          {article.summary && (
            <p className="mt-1.5 text-sm text-gray-500 line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 font-medium text-blue-700">
          {article.fund.name}
        </span>
        {date && <span>{date}</span>}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-blue-500 hover:text-blue-700 font-medium transition-colors"
        >
          Read →
        </a>
      </div>
    </div>
  );
}
