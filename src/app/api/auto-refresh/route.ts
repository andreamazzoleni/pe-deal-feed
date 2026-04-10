import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Returns funds whose last scrape is older than 24 h (or never scraped).
// The client uses this to trigger scrapes without blocking the page render.
export async function GET() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const funds = await prisma.fund.findMany({
    where: {
      OR: [
        { lastScrapeAt: null },
        { lastScrapeAt: { lt: oneDayAgo } },
      ],
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ fundsToRefresh: funds });
}
