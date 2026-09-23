import { NextResponse } from 'next/server';
import { recordReportDelivered } from '@/lib/service-operations-state';
import { REPORT_EXPECTATIONS } from '@/lib/service-operations-monitor';
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const secret = process.env.SLACK_OPS_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await readOperationalJson(request, 1024); }
  catch (error) { return NextResponse.json({ error: 'invalid_body' }, { status: error instanceof OperationalBodyError ? error.status : 400 }); }
  if (typeof body.report !== 'string') return NextResponse.json({ error: 'unknown_report' }, { status: 400 });
  if (!REPORT_EXPECTATIONS.some(r => r.id === body?.report)) return NextResponse.json({ error: 'unknown_report' }, { status: 400 });
  await recordReportDelivered(body.report);
  return NextResponse.json({ ok: true });
}
