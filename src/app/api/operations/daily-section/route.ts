import { NextResponse } from 'next/server';
import { OPS_SERVICES } from '@/lib/service-operations-data';
import { dailyOperationsSection } from '@/lib/service-operations-daily';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const secret = process.env.SLACK_OPS_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const service = OPS_SERVICES.find(s => s.key === new URL(request.url).searchParams.get('service'));
  if (!service) return NextResponse.json({ error: 'unknown_service' }, { status: 400 });
  return NextResponse.json({ text: await dailyOperationsSection(service.key) });
}
