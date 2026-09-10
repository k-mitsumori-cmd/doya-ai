import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const seen = new Map<string, number>();
export async function POST(request: NextRequest) {
  const token = process.env.HEISHA_CLIENT_ERROR_TOKEN;
  if (!token || request.headers.get('x-client-error-token') !== token) return NextResponse.json({ ok: false }, { status: 401 });
  if (Number(request.headers.get('content-length') || 0) > 512) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { event?: string; eventId?: string };
  try { const text = await request.text(); if (text.length > 512) return NextResponse.json({ ok: false }, { status: 413 }); body = JSON.parse(text); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body || body.event !== 'session_saved' || typeof body.eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.eventId)) return NextResponse.json({ ok: false }, { status: 400 });
  if (seen.has(body.eventId)) return NextResponse.json({ ok: true, duplicate: true });
  const url = process.env.HEISHA_SLACK_ERROR_WEBHOOK_URL;
  if (!url) return NextResponse.json({ ok: false }, { status: 503 });
  if (seen.size >= 1000) seen.delete(seen.keys().next().value!);
  seen.set(body.eventId, Date.now());
  try {
    const text = ['【弊社、限界につき。】利用されました', '操作：記録の保存', '結果：端末に1件保存されました。', `通知日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`, 'メモ・会社名・給与・記録の内容は送信していません。'].join('\n');
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('Slack delivery failed');
    return NextResponse.json({ ok: true });
  } catch { seen.delete(body.eventId); return NextResponse.json({ ok: false }, { status: 502 }); }
}
