import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fundId = searchParams.get('fundId') || undefined;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const keyword = searchParams.get('keyword') || '';

  type WhereClause = {
    fundId?: string;
    date?: { gte?: Date; lte?: Date };
  };

  const where: WhereClause = {};
  if (fundId) where.fundId = fundId;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }

  let articles = await prisma.article.findMany({
    where,
    include: { fund: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  // SQLite doesn't support case-insensitive LIKE via Prisma mode — filter in JS
  if (keyword) {
    const kw = keyword.toLowerCase();
    articles = articles.filter(
      (a) =>
        a.headline.toLowerCase().includes(kw) ||
        (a.summary && a.summary.toLowerCase().includes(kw)),
    );
  }

  return NextResponse.json(articles);
}
