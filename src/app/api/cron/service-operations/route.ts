import { NextResponse } from 'next/server';
import { collectDailyOperations, weeklyOperations, dailyOperationsSection } from '@/lib/service-operations-daily';
import { monitorReportDelivery } from '@/lib/service-operations-monitor';
import { pollStoreReviews } from '@/lib/service-operations-reviews';
import { monitorCost } from '@/lib/service-operations-cost';
import { claimOps, releaseOps, writeOps, readOps, sendOps } from '@/lib/service-operations-state';
import { jstDay } from '@/lib/service-operations-data';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url), mode = url.searchParams.get('mode') || 'watch', dry = url.searchParams.get('dry') === '1';
  if (!['daily', 'watch', 'reviews', 'weekly', 'cost', 'travel'].includes(mode)) return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  const slot = mode === 'watch' ? String(Math.floor(Date.now() / 900000)) : mode === 'reviews' ? String(Math.floor(Date.now() / 14400000)) : jstDay();
  const key = 'job:' + mode + ':' + slot;
  if (!dry && (await readOps('done:' + key) || !await claimOps(key, 360000))) return NextResponse.json({ skipped: true });
  try {
    let result: unknown;
    if (mode === 'daily') result = await collectDailyOperations(dry);
    else if (mode === 'reviews') result = await pollStoreReviews(dry);
    else if (mode === 'weekly') result = await weeklyOperations(dry);
    else if (mode === 'cost') result = await monitorCost(dry);
    else if (mode === 'travel') {
      result = '【旅行ツール】今日の集客チェック、いくよ！\n' + await dailyOperationsSection('travel');
      if (!dry) await sendOps('travel', String(result), 'travel-daily:' + jstDay(), 'steady');
    } else result = dry ? { note: 'watchは送信を伴うためdryでは実行しません' } : await monitorReportDelivery();
    if (!dry) await writeOps('done:' + key, { at: new Date().toISOString() });
    return NextResponse.json({ ok: true, mode, dry, result });
  } catch (error) {
    console.error('[service-operations] job failed', mode);
    return NextResponse.json({ ok: false, mode, error: 'collection_or_delivery_failed' }, { status: 503 });
  } finally { if (!dry) await releaseOps(key); }
}
