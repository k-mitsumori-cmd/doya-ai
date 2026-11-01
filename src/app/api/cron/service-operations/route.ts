import { NextResponse } from 'next/server';
import { collectDailyOperations, weeklyOperations, dailyOperationsSection } from '@/lib/service-operations-daily';
import { monitorReportDelivery } from '@/lib/service-operations-monitor';
import { pollStoreReviews } from '@/lib/service-operations-reviews';
import { monitorCost } from '@/lib/service-operations-cost';
import { claimOps, releaseOps, writeOps, readOps, sendOps } from '@/lib/service-operations-state';
import { jstDay } from '@/lib/service-operations-data';
import { notifyAlert } from '@/lib/alert';
import { formatJobFailure, nextStreak, type FailureStreak } from '@/lib/health-check-report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const rawMode = url.searchParams.get('mode');
  const mode = rawMode === null ? 'watch' : rawMode;
  const rawDry = url.searchParams.get('dry');
  if (rawDry !== null && rawDry !== '0' && rawDry !== '1') return NextResponse.json({ error: 'invalid_dry' }, { status: 400 });
  const dry = rawDry === '1';
  if (!['daily', 'watch', 'reviews', 'weekly', 'cost', 'travel'].includes(mode)) return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  const slot = mode === 'watch' ? String(Math.floor(Date.now() / 900000)) : mode === 'reviews' ? String(Math.floor(Date.now() / 14400000)) : jstDay();
  const key = 'job:' + mode + ':' + slot;
  const rolling = mode === 'watch' || mode === 'reviews';
  const doneKey = rolling ? 'done:job:' + mode : 'done:' + key;
  if (!dry) {
    const lastDone = await readOps<{ slot?: string }>(doneKey);
    // 旧バージョンで記録済みの枠も、切り替え当日には再実行しない。
    if ((rolling ? lastDone?.slot === slot || await readOps('done:' + key) : lastDone) || !await claimOps(key, 360000)) {
      return NextResponse.json({ skipped: true });
    }
  }
  try {
    let result: unknown;
    if (mode === 'daily') result = await collectDailyOperations(dry);
    else if (mode === 'reviews') result = await pollStoreReviews(dry);
    else if (mode === 'weekly') result = await weeklyOperations(dry);
    else if (mode === 'cost') result = await monitorCost(dry);
    else if (mode === 'travel') {
      result = '【旅行ツール】今日の集客チェック\n' + await dailyOperationsSection('travel');
      if (!dry) await sendOps('travel', String(result), 'travel-daily:' + jstDay(), 'steady');
    } else result = dry ? { note: 'watchは送信を伴うためdryでは実行しません' } : await monitorReportDelivery();
    if (!dry) await writeOps(doneKey, { at: new Date().toISOString(), ...(rolling ? { slot } : {}) });
    if (!dry && (await readOps<FailureStreak>('job-fail:' + mode).catch(() => null))?.count) await writeOps('job-fail:' + mode, { count: 0, since: '' }).catch(() => {});
    return NextResponse.json({ ok: true, mode, dry, result });
  } catch (error) {
    // 「失敗した」だけで終わらせず、モード・エラー文・発生箇所・連続回数を Slack に出す（ログは種類と回数だけ）
    const at = new Date().toISOString();
    const previous = await readOps<FailureStreak>('job-fail:' + mode).catch(() => null);
    const streak = nextStreak(previous, true, at);
    if (!dry) await writeOps('job-fail:' + mode, streak).catch(() => {});
    const detail = formatJobFailure({ mode, at, error, streak });
    const errorType = error instanceof Error ? error.name : 'non-Error';
    // ログには例外の本文を書かない決まり（verify-api-error-log-privacy）。本文は運用チャンネルの通知にだけ載せる
    console.error('[service-operations] job failed', JSON.stringify({ mode, type: errorType, failures: streak?.count, at }));
    if (!dry) await notifyAlert({ title: `運用ジョブの失敗（mode=${mode}）`, level: 'warn', context: '/api/cron/service-operations?mode=' + mode, detail, dedupKey: 'ops-job-' + mode, cooldownMs: 60 * 60_000 });
    return NextResponse.json({ ok: false, mode, error: 'collection_or_delivery_failed', message: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300), failures: streak?.count, at }, { status: 503 });
  } finally { if (!dry) await releaseOps(key); }
}
