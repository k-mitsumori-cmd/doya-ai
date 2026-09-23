import { NextRequest, NextResponse } from 'next/server';
import { sendServiceDownloadReports } from '@/lib/service-download-report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const results = await sendServiceDownloadReports(request.nextUrl.searchParams.get('dry') === '1');
  return NextResponse.json({ results });
}
