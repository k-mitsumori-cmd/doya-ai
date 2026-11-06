import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/quote/products/analyze — サービスURLを解析して商材プロフィールを返す
// ⚠️ 保存はしない（解析結果を画面で確認してから登録する）
import { NextRequest } from 'next/server'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { analyzeProduct } from '@/lib/quote/analyze'
import { withDoyaPowerCharge } from '@/lib/doya-power/charge'

async function postHandler(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return privateApiJson({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string' || body.url.length > 2048) {
    return privateApiJson({ error: 'URLの形式が正しくありません' }, { status: 400 })
  }
  const rawUrl = body.url.trim()
  if (!rawUrl) return privateApiJson({ error: 'URLを入力してください' }, { status: 400 })

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  } catch {
    return privateApiJson({ error: 'URLの形式が正しくありません' }, { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return privateApiJson({ error: 'httpsのURLを入力してください' }, { status: 400 })
  }
  if (url.username || url.password || url.toString().length > 2048) {
    return privateApiJson({ error: '認証情報を含まない2048文字以内のURLを入力してください' }, { status: 400 })
  }

  try {
    const profile = await analyzeProduct(url.toString())
    return privateApiJson({ profile, sourceUrl: url.toString() })
  } catch (err) {
    console.error('[quote] analyze failed')
    return privateApiJson({ error: 'サイトの解析に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }
}

// ドヤパワー（旗 DOYA_POWER_ROLLOUT の内側だけ）: AI を呼ぶ前に減らし、失敗なら戻す。足りないときは 402 と日本語の理由（src/lib/doya-power/charge.ts）
export const POST = withDoyaPowerCharge({ action: 'text.generate' }, postHandler)
