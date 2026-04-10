import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const funds = await prisma.fund.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(funds);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name ?? '').trim();
  const url = (body.url ?? '').trim();

  if (!name || !url) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const fund = await prisma.fund.create({ data: { name, url } });
  return NextResponse.json(fund, { status: 201 });
}
