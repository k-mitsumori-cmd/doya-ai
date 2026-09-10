import { NextRequest, NextResponse } from 'next/server';
import { reportRuntimeFailure } from '@/lib/runtime-alert';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const sameOrigin = origin === request.nextUrl.origin;
  const token = request.headers.get('x-client-error-token');
  const native = !!process.env.CLIENT_ERROR_TOKEN && token === process.env.CLIENT_ERROR_TOKEN;
  const heisha = !!process.env.HEISHA_CLIENT_ERROR_TOKEN && token === process.env.HEISHA_CLIENT_ERROR_TOKEN;
  if (!sameOrigin && !native && !heisha) return NextResponse.json({ ok: false }, { status: 401 });
  if (Number(request.headers.get('content-length') || 0) > 1024) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { kind?: string };
  try {
    const text = await request.text();
    if (text.length > 1024) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(text);
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body || !['javascript', 'render', 'promise'].includes(body.kind || '')) return NextResponse.json({ ok: false }, { status: 400 });
  const label = body.kind === 'render' ? '画面の表示エラー' : body.kind === 'promise' ? '非同期処理の未処理エラー' : '未処理のJavaScriptエラー';
  if (heisha) {
    const { reportHeishaFailure } = await import('@/lib/heisha-runtime-alert');
    await reportHeishaFailure(label);
  } else {
    await reportRuntimeFailure(`${native ? 'スマホアプリ' : 'ブラウザー'}：${label}`);
  }
  return NextResponse.json({ ok: true });
}
