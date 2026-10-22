// ============================================
// ドヤくんの表示と演出の設定（組織・個人。純粋関数）
// ============================================
// - mascot  … ドヤくんの絵を出すか
// - effects … 動き（ゲージが伸びる・スタンプが押される・数字が増える・画像のフェードなど）を出すか
// 組織と個人の両方がオンのときだけオン。組織がオフにしたものは、個人で戻せない。
// 省略した項目は「オン」。prefers-reduced-motion のときは、設定にかかわらず動かさない（部品の側で見る）。
// 保存先（Prisma のスキーマは変えない）:
//   組織 … SystemSetting（key: doya_power_fx:org:<companyId>、value: JSON 文字列）。会社の持ち主だけが変えられる
//   個人 … SystemSetting（key: doya_power_fx:user:<userId>）。本人だけが変えられる
// 読み書きは fx.server.ts / fx-actions.ts。ここは DB に触れない。

export type DoyaPowerFxSetting = { mascot?: boolean; effects?: boolean }
export type DoyaPowerFx = { org?: DoyaPowerFxSetting; user?: DoyaPowerFxSetting }
export type ResolvedFx = { mascot: boolean; effects: boolean }
export type FxScope = 'org' | 'user'

export const FX_KEY_PREFIX = 'doya_power_fx:'

export function fxKey(scope: FxScope, id: string): string {
  return `${FX_KEY_PREFIX}${scope}:${id}`
}

/** 組織と個人の設定を合わせる。どちらかがオフならオフ */
export function resolveDoyaPowerFx(fx?: DoyaPowerFx): ResolvedFx {
  return {
    mascot: fx?.org?.mascot !== false && fx?.user?.mascot !== false,
    effects: fx?.org?.effects !== false && fx?.user?.effects !== false,
  }
}

/** 保存した文字列を読む。壊れていたら空（＝すべてオン） */
export function parseFxSetting(raw: string | null | undefined): DoyaPowerFxSetting {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return {}
    const o = v as Record<string, unknown>
    const out: DoyaPowerFxSetting = {}
    if (typeof o.mascot === 'boolean') out.mascot = o.mascot
    if (typeof o.effects === 'boolean') out.effects = o.effects
    return out
  } catch {
    return {}
  }
}

/** 保存する中身（想定外の項目は捨てる） */
export function serializeFxSetting(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  if (typeof o.mascot !== 'boolean' || typeof o.effects !== 'boolean') return null
  return JSON.stringify({ mascot: o.mascot, effects: o.effects })
}
