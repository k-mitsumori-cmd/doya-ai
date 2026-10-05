export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST  /api/mensetsu/live/[token]/recording — 署名付きアップロードURLを発行
// PATCH /api/mensetsu/live/[token]/recording — アップロード完了を記録
//
// 音声はブラウザから Supabase へ直接送る（サーバ経由だと Vercel の本文上限4.5MBに当たる）。
// ⚠️ 組織設定 recordAudio が OFF の場合は発行しない。同意していない録音を作らないため。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken } from '@/lib/mensetsu/public'
import { createSignedUploadUrl, recordingExists } from '@/lib/mensetsu/storage'

type Ctx = { params: Promise<{ token: string }> }

function pathFor(sessionId: string) {
  return `sessions/${sessionId}/interview.webm`
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  // ⚠️ 音声・映像のどちらかが有効なら発行する。映像だけ有効な設定もありうる
  if (!s.organization.recordAudio) {
    return NextResponse.json({ error: 'この組織では録画・録音を保存しません' }, { status: 403 })
  }
  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  try {
    const { signedUrl, token, path } = await createSignedUploadUrl(pathFor(s.id))
    return NextResponse.json({ signedUrl, token, path })
  } catch (e: any) {
    console.error('[mensetsu/live/[token]/recording] unexpected error')
    return NextResponse.json({ error: 'URLの発行に失敗しました' }, { status: 502 })
  }
}

export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  if (!s.organization.recordAudio) {
    return NextResponse.json({ error: 'この組織では録画・録音を保存しません' }, { status: 403 })
  }

  const path = pathFor(s.id)
  // クライアントの自己申告を信じず、実際に置かれたか確認してからDBに書く。
  // 存在しないパスを記録すると、削除cronが消せない幽霊レコードになる。
  if (!(await recordingExists(path))) {
    return NextResponse.json({ error: '録音が確認できませんでした' }, { status: 400 })
  }

  // 録音情報は評価の入力ではない。@updatedAt を更新すると、同じ時刻で識別する
  // 評価の実行権が失われるため、保存先だけを更新する。保持期限・同意・組織設定は
  // 保存時にも確認し、削除cronや終了通知が先に進んだ場合に記録を復活させない。
  const saved = await prisma.$executeRaw`
    UPDATE mensetsu_sessions AS s SET "recordingPath" = ${path}
    WHERE s.id = ${s.id} AND s."consentedAt" IS NOT NULL AND s."startedAt" IS NOT NULL
      AND s.status IN ('live', 'completed', 'evaluating', 'evaluated', 'aborted')
      AND (s."purgeAfter" IS NULL OR s."purgeAfter" > CURRENT_TIMESTAMP)
      AND EXISTS (
        SELECT 1 FROM mensetsu_organizations AS o
        WHERE o.id = s."organizationId" AND o."recordAudio" = true
      )
  `
  if (saved !== 1) {
    return NextResponse.json({ error: '録音の保存対象の状態が変わりました。' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
