// ============================================
// ドヤパワー（ポイント制とゲーミフィケーション）を出すかどうか
// ============================================
// 新しい見た目（UI_NEXT_ROLLOUT）は全員に出しているので、useUiNext() の内側に入れるだけでは全員に見える。
// ドヤパワーは、この旗で別に出し分ける。
//   DOYA_POWER_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）
//   DOYA_POWER_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ（src/lib/ui-next.ts の canPreviewUiNext）
//   DOYA_POWER_ROLLOUT=all      … 全員
// ⚠️ 判定はサーバーだけで行う。クライアントの部品には (shell)/layout.tsx が context で渡す（doya-power-context.tsx）。
// ⚠️ off のときは、セッションも DB も読まずに false を返す。台帳の表（doya_power_*）は本番DBにまだ無いので、
//    off のまま台帳を読む・書くコードが動くと落ちる。台帳の入口（index.ts）もこの旗で止める。
// ⚠️ 新しい見た目（isUiNext()）とは別の判定。両方が真のときだけ画面を出す（各ページで両方を見る）。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type DoyaPowerRollout = 'off' | 'preview' | 'all'

/** 環境変数の値を読む。既定は off（preview と all だけを受け付ける） */
export function doyaPowerRollout(raw: string | undefined = process.env.DOYA_POWER_ROLLOUT): DoyaPowerRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideDoyaPower(input: {
  rollout: DoyaPowerRollout
  email: string | null | undefined
  allow: string[]
}): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** 台帳（doya_power_* の表）を使ってよいか。off なら誰の分も使わない（人を問わない判定） */
export function doyaPowerLedgerAllowed(rollout: DoyaPowerRollout = doyaPowerRollout()): boolean {
  return rollout !== 'off'
}

/**
 * 今のリクエストの人に、ドヤパワーを出すか（サーバーの layout・page・API で使う）。
 * ⚠️ off のときは、セッションを読まずに false。判定に失敗したときも false（出さない）。
 */
export async function isDoyaPowerEnabled(): Promise<boolean> {
  const rollout = doyaPowerRollout()
  if (rollout === 'off') return false
  if (rollout === 'all') return true
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    return decideDoyaPower({ rollout, email: session?.user?.email, allow: uiPreviewEmails() })
  } catch {
    return false
  }
}

/**
 * 見本のデータだけで開く確認用のページ（/home/collection/preview など）を開いてよいか。
 * 旗が off なら開かない（各ページの、開発のときだけ・COLLECTION_PREVIEW=1 などの条件に加えて見る）。
 * ⚠️ /ds-preview/doya-power だけは別。ds-preview の決まり（DS_PREVIEW=1。本番の環境変数には置かない）で開き、
 *    見本の数字だけを出す（台帳・DB・API に触れない）。
 */
export function doyaPowerSampleAllowed(rollout: DoyaPowerRollout = doyaPowerRollout()): boolean {
  return rollout !== 'off'
}
