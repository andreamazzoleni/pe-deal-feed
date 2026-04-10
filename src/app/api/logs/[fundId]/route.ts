import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fundId: string }> },
) {
  const { fundId } = await params;
  const logs = await prisma.scrapeLog.findMany({
    where: { fundId },
    orderBy: { timestamp: 'desc' },
    take: 25,
  });
  return NextResponse.json(logs);
}
