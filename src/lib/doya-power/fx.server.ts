// ドヤくんの表示と演出の設定を読む（サーバーだけ。読むだけ）。
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が off のときは DB に触れずに空（＝すべてオン）を返す。
// ⚠️ 表が読めない・設定が無いときも空（画面は止めない）。
import { prisma } from '@/lib/prisma'
import { doyaPowerRollout } from './flag'
import { fxKey, parseFxSetting, type DoyaPowerFx } from './fx'

export async function loadDoyaPowerFx(input: { userId: string; companyId?: string | null }): Promise<DoyaPowerFx> {
  if (doyaPowerRollout() === 'off') return {}
  try {
    const keys = [fxKey('user', input.userId), ...(input.companyId ? [fxKey('org', input.companyId)] : [])]
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } })
    const byKey = new Map(rows.map((r) => [r.key, r.value]))
    return {
      user: parseFxSetting(byKey.get(fxKey('user', input.userId))),
      org: input.companyId ? parseFxSetting(byKey.get(fxKey('org', input.companyId))) : {},
    }
  } catch {
    return {}
  }
}

/** 本人の会社（account_companies の userId）を引いて、設定と「会社の設定を変えられるか」を返す。会社は本人のものだけ */
export async function loadDoyaPowerFxForUser(userId: string): Promise<{ fx: DoyaPowerFx; canEditOrg: boolean }> {
  if (doyaPowerRollout() === 'off') return { fx: {}, canEditOrg: false }
  let companyId: string | null = null
  try {
    companyId = (await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null
  } catch {
    companyId = null
  }
  return { fx: await loadDoyaPowerFx({ userId, companyId }), canEditOrg: companyId !== null }
}
