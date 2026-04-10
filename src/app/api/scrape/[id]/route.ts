import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrape } from '@/lib/scraper';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const fund = await prisma.fund.findUnique({ where: { id } });
  if (!fund) {
    return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
  }

  // Compute historical average from last 5 successful scrapes
  const recentLogs = await prisma.scrapeLog.findMany({
    where: { fundId: id, status: 'success' },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });
  const avgCount =
    recentLogs.length > 0
      ? recentLogs.reduce((s, l) => s + l.itemsExtracted, 0) / recentLogs.length
      : undefined;

  const result = await scrape(fund.url, avgCount);

  // Upsert articles (keyed on fundId + url to avoid duplicates)
  if (result.articles.length > 0) {
    await Promise.all(
      result.articles.map((a) =>
        prisma.article.upsert({
          where: { fundId_url: { fundId: id, url: a.url } },
          update: {
            headline: a.headline,
            date: a.date ?? undefined,
            summary: a.summary ?? undefined,
          },
          create: {
            fundId: id,
            headline: a.headline,
            url: a.url,
            date: a.date ?? undefined,
            summary: a.summary ?? undefined,
          },
        }),
      ),
    );
  }

  // Record scrape attempt
  await prisma.scrapeLog.create({
    data: {
      fundId: id,
      itemsExtracted: result.itemsExtracted,
      status: result.status,
      errorMessage: result.errorMessage ?? null,
    },
  });

  // Persist latest status on the fund row for fast querying
  await prisma.fund.update({
    where: { id },
    data: {
      lastScrapeAt: new Date(),
      lastScrapeStatus: result.status,
      lastScrapeMessage: result.errorMessage ?? null,
    },
  });

  return NextResponse.json({
    status: result.status,
    itemsExtracted: result.itemsExtracted,
    errorMessage: result.errorMessage ?? null,
  });
}
