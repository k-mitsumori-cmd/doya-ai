'use server'
// ドヤくんの表示と演出の設定を保存する（サーバーアクション）。
// - 個人（user）… 本人だけ。キーはセッションの本人の id から決める
// - 組織（org） … 会社の持ち主（account_companies の userId）だけ。会社はセッションの本人の会社だけ（引数の id は信じない）
// ⚠️ 旗が off のときは何も書かない。
import { prisma } from '@/lib/prisma'
import { currentUserId } from '@/lib/shell/company.server'
import { isDoyaPowerEnabled } from './flag'
import { fxKey, serializeFxSetting, type FxScope } from './fx'

export type SaveFxResult = { ok: true } | { ok: false; message: string }

export async function saveDoyaPowerFx(scope: FxScope, setting: { mascot: boolean; effects: boolean }): Promise<SaveFxResult> {
  if (!(await isDoyaPowerEnabled())) return { ok: false, message: 'この設定はまだ使えません' }
  const value = serializeFxSetting(setting)
  if (!value || (scope !== 'org' && scope !== 'user')) return { ok: false, message: '設定の中身が正しくありません' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'ログインしてください' }
  try {
    let id = userId
    if (scope === 'org') {
      const company = await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
      if (!company) return { ok: false, message: '会社が登録されていません' }
      id = company.id
    }
    const key = fxKey(scope, id)
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
    return { ok: true }
  } catch {
    return { ok: false, message: '保存できませんでした。時間をおいて、もう一度お試しください' }
  }
}
