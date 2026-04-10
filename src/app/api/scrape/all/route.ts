import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrape } from '@/lib/scraper';

export async function POST() {
  const funds = await prisma.fund.findMany();

  const results = await Promise.allSettled(
    funds.map(async (fund) => {
      const recentLogs = await prisma.scrapeLog.findMany({
        where: { fundId: fund.id, status: 'success' },
        orderBy: { timestamp: 'desc' },
        take: 5,
      });
      const avgCount =
        recentLogs.length > 0
          ? recentLogs.reduce((s, l) => s + l.itemsExtracted, 0) / recentLogs.length
          : undefined;

      const result = await scrape(fund.url, avgCount);

      if (result.articles.length > 0) {
        await Promise.all(
          result.articles.map((a) =>
            prisma.article.upsert({
              where: { fundId_url: { fundId: fund.id, url: a.url } },
              update: {
                headline: a.headline,
                date: a.date ?? undefined,
                summary: a.summary ?? undefined,
              },
              create: {
                fundId: fund.id,
                headline: a.headline,
                url: a.url,
                date: a.date ?? undefined,
                summary: a.summary ?? undefined,
              },
            }),
          ),
        );
      }

      await prisma.scrapeLog.create({
        data: {
          fundId: fund.id,
          itemsExtracted: result.itemsExtracted,
          status: result.status,
          errorMessage: result.errorMessage ?? null,
        },
      });

      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          lastScrapeAt: new Date(),
          lastScrapeStatus: result.status,
          lastScrapeMessage: result.errorMessage ?? null,
        },
      });

      return { fundId: fund.id, name: fund.name, ...result };
    }),
  );

  const summary = results.map((r, i) => ({
    fund: funds[i].name,
    ...(r.status === 'fulfilled'
      ? { status: r.value.status, items: r.value.itemsExtracted }
      : { status: 'error', error: String(r.reason) }),
  }));

  return NextResponse.json({ summary });
}
