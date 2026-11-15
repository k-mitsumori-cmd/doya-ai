import { NextRequest, NextResponse } from 'next/server';
import { voicePayload } from '@/lib/slack-voice';
import { buildDailyReportText } from '@/lib/heisha-activity-format';
import { jstDayKeyOffset, purgeOldHeishaKeys, readHeishaDay } from '@/lib/heisha-activity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 弊社、限界につき。の日次レポート（前日の保存件数・種別の割合・文字数の平均）。毎日 日本時間 9:00 に送る。
// ?dry=1 なら Slack へは送らず、文面だけ返す。
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const [today, prev] = await Promise.all([readHeishaDay(jstDayKeyOffset(-1)), readHeishaDay(jstDayKeyOffset(-2))]);
  // 前々日の集計が全く無い（件数0で種別も無い）ときは、比較を出さない。
  const text = buildDailyReportText(today, prev.total > 0 ? prev : null);
  if (dry) return NextResponse.json({ dry: true, text });
  const url = process.env.HEISHA_SLACK_ERROR_WEBHOOK_URL;
  if (!url) return NextResponse.json({ ok: false, error: 'destination missing' }, { status: 503 });
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(voicePayload({ text }, { app: '弊社、限界につき。', kind: 'report', severity: 'info' })), signal: AbortSignal.timeout(5000) });
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 502 });
  await purgeOldHeishaKeys().catch(() => {});
  return NextResponse.json({ ok: true });
}
