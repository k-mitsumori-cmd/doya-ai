import { voicePayload } from '../../../lib/slack-voice';
import { NextRequest, NextResponse } from 'next/server';
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json';
import { clientIp, consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota';
import { buildSavedText, parseHeishaActivity, HEISHA_LIMITS } from '@/lib/heisha-activity-format';
import { claimHeishaEvent, countHeishaSave, releaseHeishaEvent, uncountHeishaSave } from '@/lib/heisha-activity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 回数の上限（日本時間の1日あたり）。端末の識別子は受け取らないので、接続元 IP（鍵付きハッシュ）と、このトークン全体で数える。
const DAILY_PER_IP = 300;
const DAILY_PER_TOKEN = 5000;
// 本番以外の環境では DB を使わない。件数は出さず、同じインスタンス内の重複だけ止める。
const seen = new Map<string, number>();

export async function POST(request: NextRequest) {
  const token = process.env.HEISHA_CLIENT_ERROR_TOKEN;
  if (!token || request.headers.get('x-client-error-token') !== token) return NextResponse.json({ ok: false }, { status: 401 });
  let raw: Record<string, unknown>;
  try { raw = await readOperationalJson(request, HEISHA_LIMITS.bodyBytes); }
  catch (error) { return NextResponse.json({ ok: false }, { status: error instanceof OperationalBodyError ? error.status : 400 }); }
  const input = parseHeishaActivity(raw);
  if (!input) return NextResponse.json({ ok: false }, { status: 400 });
  const url = process.env.HEISHA_SLACK_ERROR_WEBHOOK_URL;
  if (!url) return NextResponse.json({ ok: false }, { status: 503 });
  const production = process.env.VERCEL_ENV === 'production';
  let todayCount: number | null = null;
  let counted = false;
  if (production) {
    const limits = [await consumeDailyQuota('heisha-act-ip', quotaSubject(clientIp(request.headers)), DAILY_PER_IP), await consumeDailyQuota('heisha-act-token', 'all', DAILY_PER_TOKEN)];
    if (limits.includes('limited')) return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': '3600' } });
    if (limits.includes('unavailable')) return NextResponse.json({ ok: false }, { status: 503, headers: { 'Retry-After': '30' } });
    try {
      if (!(await claimHeishaEvent(input.eventId))) return NextResponse.json({ ok: true, duplicate: true });
      todayCount = await countHeishaSave(input.kind, input.length);
      counted = true;
    } catch {
      await releaseHeishaEvent(input.eventId).catch(() => {});
      return NextResponse.json({ ok: false }, { status: 503, headers: { 'Retry-After': '30' } });
    }
  } else {
    if (seen.has(input.eventId)) return NextResponse.json({ ok: true, duplicate: true });
    if (seen.size >= 1000) seen.delete(seen.keys().next().value!);
    seen.set(input.eventId, Date.now());
  }
  try {
    // 抜粋は SLACK_INCLUDE_EXCERPT=1 のときだけ載せる。それ以外では受け取っても捨てる。
    const text = buildSavedText(input, todayCount, { includeExcerpt: process.env.SLACK_INCLUDE_EXCERPT === '1' });
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(voicePayload({ text }, { app: '弊社、限界につき。', kind: 'usage', severity: 'info' })), signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Slack delivery failed');
    return NextResponse.json({ ok: true });
  } catch {
    seen.delete(input.eventId);
    if (counted) { await uncountHeishaSave(input.kind, input.length).catch(() => {}); await releaseHeishaEvent(input.eventId).catch(() => {}); }
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
