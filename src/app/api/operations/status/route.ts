import { NextResponse } from 'next/server';
import { reportWatchStatus } from '@/lib/service-operations-monitor';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const secret = process.env.SLACK_OPS_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await reportWatchStatus());
}
