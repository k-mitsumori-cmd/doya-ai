import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: 配信停止確認ページ（HTMLを返す）
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse(renderPage('無効なリンクです', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    const { userId } = decodeToken(token)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user) {
      return new NextResponse(renderPage('ユーザーが見つかりません', false), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new NextResponse(renderConfirmPage(user.email || '', token), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new NextResponse(renderPage('無効なリンクです', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

// POST: 配信停止実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 })
    }

    const { userId } = decodeToken(token)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 配信停止記録
    await prisma.dripUnsubscribe.create({
      data: {
        userId,
        reason: 'user_requested',
      },
    })

    // アクティブなエンロールメントをすべてキャンセル
    await prisma.dripEnrollment.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'cancelled' },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '配信停止処理に失敗しました' }, { status: 500 })
  }
}

function decodeToken(token: string): { userId: string } {
  const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
  if (!decoded.userId) throw new Error('Invalid token')
  return decoded
}

function renderConfirmPage(email: string, token: string): string {
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>配信停止 - ドヤAI</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 40px 16px; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
  h1 { font-size: 20px; color: #1e293b; margin: 0 0 12px; }
  p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
  .email { font-weight: bold; color: #1e293b; }
  button { background: #ef4444; color: #fff; border: none; border-radius: 12px; padding: 14px 32px; font-size: 15px; font-weight: bold; cursor: pointer; width: 100%; }
  button:hover { background: #dc2626; }
  .back { display: inline-block; margin-top: 16px; color: #3b82f6; text-decoration: none; font-size: 13px; }
  .done { color: #16a34a; font-size: 16px; font-weight: bold; }
</style>
</head>
<body>
<div class="card">
  <h1>メール配信を停止しますか？</h1>
  <p><span class="email">${maskedEmail}</span> 宛てのドヤAIからのマーケティングメールの配信を停止します。</p>
  <button id="btn" onclick="doUnsubscribe()">配信を停止する</button>
  <div id="result"></div>
  <a href="https://doya-ai.surisuta.jp" class="back">← ドヤAIに戻る</a>
</div>
<script>
async function doUnsubscribe() {
  const btn = document.getElementById('btn');
  const result = document.getElementById('result');
  btn.disabled = true;
  btn.textContent = '処理中...';
  try {
    const res = await fetch('/api/drip/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '${token}' })
    });
    if (res.ok) {
      btn.style.display = 'none';
      result.innerHTML = '<p class="done">配信を停止しました。</p><p>今後マーケティングメールは届きません。</p>';
    } else {
      btn.textContent = '配信を停止する';
      btn.disabled = false;
      result.innerHTML = '<p style="color:#ef4444">エラーが発生しました。もう一度お試しください。</p>';
    }
  } catch(e) {
    btn.textContent = '配信を停止する';
    btn.disabled = false;
    result.innerHTML = '<p style="color:#ef4444">通信エラーが発生しました。</p>';
  }
}
</script>
</body>
</html>`
}

function renderPage(message: string, _success: boolean): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>配信停止 - ドヤAI</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f8fafc; margin: 0; padding: 40px 16px; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
  h1 { font-size: 20px; color: #1e293b; }
</style>
</head>
<body><div class="card"><h1>${message}</h1><a href="https://doya-ai.surisuta.jp">ドヤAIに戻る</a></div></body>
</html>`
}
