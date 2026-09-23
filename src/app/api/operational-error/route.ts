import { NextRequest, NextResponse } from 'next/server';
import { reportRuntimeFailure } from '@/lib/runtime-alert';
import { claimClientErrorReport, type ClientErrorKind } from '@/lib/operational-error-limit';
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  // Origin only prevents cross-site browser requests; it is not authentication.
  const sameOrigin = origin === request.nextUrl.origin
    && (!request.headers.get('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin');
  const token = request.headers.get('x-client-error-token');
  const native = !!process.env.CLIENT_ERROR_TOKEN && token === process.env.CLIENT_ERROR_TOKEN;
  const heisha = !!process.env.HEISHA_CLIENT_ERROR_TOKEN && token === process.env.HEISHA_CLIENT_ERROR_TOKEN;
  if (!sameOrigin && !native && !heisha) return NextResponse.json({ ok: false }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await readOperationalJson(request, 1024);
  } catch (error) { return NextResponse.json({ ok: false }, { status: error instanceof OperationalBodyError ? error.status : 400 }); }
  if (typeof body.kind !== 'string' || !['javascript', 'render', 'promise'].includes(body.kind)) return NextResponse.json({ ok: false }, { status: 400 });
  // Preview/local reporting is disabled; never consume the production DB budget.
  if (process.env.VERCEL_ENV !== 'production') return NextResponse.json({ ok: true });
  const admission = await claimClientErrorReport(heisha ? 'heisha' : native ? 'native' : 'browser', body.kind as ClientErrorKind);
  if (admission !== 'allowed') return NextResponse.json({ ok: false }, {
    status: admission === 'limited' ? 429 : 503,
    headers: { 'Retry-After': admission === 'limited' ? '600' : '30' },
  });
  const label = body.kind === 'render' ? '画面の表示エラー' : body.kind === 'promise' ? '非同期処理の未処理エラー' : '未処理のJavaScriptエラー';
  if (heisha) {
    const { reportHeishaFailure } = await import('@/lib/heisha-runtime-alert');
    await reportHeishaFailure(label);
  } else {
    await reportRuntimeFailure(`${native ? 'スマホアプリ' : 'ブラウザー'}：${label}`, { clientReported: true });
  }
  return NextResponse.json({ ok: true });
}
