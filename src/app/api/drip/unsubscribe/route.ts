import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { verifyAndDecodeToken } from '@/lib/drip-tokens'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: 配信停止確認ページ（HTMLを返す）
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse(renderPage('無効なリンクです'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    const { userId } = verifyAndDecodeToken(token)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user) {
      // ユーザー列挙攻撃防止: 存在しなくても同じ画面を返す
      return new NextResponse(renderPage('無効なリンクです'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new NextResponse(renderConfirmPage(user.email || '', token), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return new NextResponse(renderPage('無効なリンクです'), {
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

    const { userId } = verifyAndDecodeToken(token)

    const user = await withRetry(() => prisma.user.findUnique({ where: { id: userId } }))
    if (!user) {
      // ユーザー列挙攻撃防止: 存在しなくても成功を返す
      return NextResponse.json({ success: true })
    }

    // 既に配信停止済みかチェック（冪等性確保）
    const existing = await withRetry(() => prisma.dripUnsubscribe.findFirst({
      where: { userId },
    }))
    if (!existing) {
      await withRetry(() => prisma.dripUnsubscribe.create({
        data: {
          userId,
          reason: 'user_requested',
        },
      }))
    }

    // アクティブなエンロールメントをすべてキャンセル
    await withRetry(() => prisma.dripEnrollment.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'cancelled' },
    }))

    return NextResponse.json({ success: true })
  } catch (e: any) {
    // トークン検証エラー（不正トークン・期限切れ）→ セキュリティ上 success: true
    if (e?.message?.includes('token') || e?.message?.includes('Token') || e?.message?.includes('Invalid')) {
      return NextResponse.json({ success: true })
    }
    // DB接続エラー等 → 500を返してユーザーにリトライを促す
    console.error('[Drip] Unsubscribe error:', e?.message)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ============================================
// HTML テンプレート
// ============================================

function renderConfirmPage(email: string, token: string): string {
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  // XSS対策: トークンをエスケープ
  const safeToken = token.replace(/['"<>&]/g, '')
  const safeMaskedEmail = maskedEmail.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }
    return map[c] || c
  })

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
  <p><span class="email">${safeMaskedEmail}</span> 宛てのドヤAIからのマーケティングメールの配信を停止します。</p>
  <button id="btn" onclick="doUnsubscribe()">配信を停止する</button>
  <div id="result"></div>
  <a href="https://doya-ai.surisuta.jp" class="back">&larr; ドヤAIに戻る</a>
</div>
<script>
async function doUnsubscribe() {
  var btn = document.getElementById('btn');
  var result = document.getElementById('result');
  btn.disabled = true;
  btn.textContent = '処理中...';
  try {
    var res = await fetch('/api/drip/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: "${safeToken}" })
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

function renderPage(message: string): string {
  const safeMessage = message.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }
    return map[c] || c
  })
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
<body><div class="card"><h1>${safeMessage}</h1><a href="https://doya-ai.surisuta.jp">ドヤAIに戻る</a></div></body>
</html>`
}
