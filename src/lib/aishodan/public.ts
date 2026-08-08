// ============================================
// ドヤAI商談 ゲスト向け公開境界
// ============================================
// ⚠️ 本サービス最大のセキュリティ論点。
//    /api/aishodan/room/* は**未ログインの第三者が叩ける**。
//    ここを通して返却フィールドをホワイトリスト化し、
//    組織・他セッション・内部設定が漏れないようにする。
//
// ⚠️ Prismaのモデルをそのまま返さないこと。
//    フィールドを足したときに、意図せず公開される事故が起きる。
import { prisma } from '@/lib/prisma'
import type { Guardrails, Persona, Phase, ProductProfile, ScenarioConfig, Slot } from './types'

/** roomToken から、進行に必要な最小限を解決する */
export async function loadRoomByToken(token: string) {
  if (!token || token.length < 8) return null
  return prisma.aishodanRoom.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true, retentionDays: true } },
      scenario: {
        include: {
          product: { select: { id: true, name: true, profile: true } },
        },
      },
    },
  })
}

export type LoadedRoom = NonNullable<Awaited<ReturnType<typeof loadRoomByToken>>>

/** 商談を開始してよい部屋か */
export function assertRoomUsable(room: LoadedRoom): { ok: true } | { ok: false; reason: string; status: number } {
  if (!room.isActive) return { ok: false, reason: 'この商談ルームは現在ご利用いただけません。', status: 403 }
  if (room.expiresAt && room.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'この商談ルームの公開期間は終了しました。', status: 410 }
  }
  if (room.sessionCount >= room.maxSessions) {
    return { ok: false, reason: '現在この商談ルームはご利用いただけません。お手数ですが担当者までご連絡ください。', status: 429 }
  }
  return { ok: true }
}

/** ゲストの画面に出してよい部屋の情報だけを取り出す */
export function toPublicRoom(room: LoadedRoom) {
  const cfg = toScenarioConfig(room.scenario)
  return {
    roomName: room.name,
    companyName: room.organization.name,
    productName: room.scenario.product.name,
    // 冒頭の説明に使う。料金や社内向けの注意書きは出さない
    oneLiner: (room.scenario.product.profile as ProductProfile | null)?.oneLiner ?? null,
    durationMin: cfg.durationMin,
    phaseNames: cfg.phases.map((p) => p.name),
    retentionDays: room.organization.retentionDays,
  }
}

/** ゲストの画面に出してよいセッション情報だけを取り出す */
export function toPublicSession(s: {
  id: string
  status: string
  currentPhase: string
  consentedAt: Date | null
  startedAt: Date | null
  endedAt: Date | null
  guestName: string | null
}) {
  return {
    id: s.id,
    status: s.status,
    currentPhase: s.currentPhase,
    consented: Boolean(s.consentedAt),
    started: Boolean(s.startedAt),
    ended: Boolean(s.endedAt),
    guestName: s.guestName,
  }
}

/** シナリオのJSONを型付きで取り出す（欠けていても落ちないようにする） */
export function toScenarioConfig(scenario: {
  phases: unknown
  slots: unknown
  icp: unknown
  guardrails: unknown
  persona: unknown
  durationMin: number
}): ScenarioConfig {
  return {
    phases: (Array.isArray(scenario.phases) ? scenario.phases : []) as Phase[],
    slots: (Array.isArray(scenario.slots) ? scenario.slots : []) as Slot[],
    icp: (scenario.icp && typeof scenario.icp === 'object' ? scenario.icp : { conditions: [] }) as ScenarioConfig['icp'],
    guardrails: (scenario.guardrails && typeof scenario.guardrails === 'object'
      ? scenario.guardrails
      : { pricePolicy: 'rough', competitorPolicy: 'neutral', prohibitedTopics: [], noEvidenceBehavior: 'defer' }) as Guardrails,
    persona: (scenario.persona && typeof scenario.persona === 'object'
      ? scenario.persona
      : { tone: '丁寧な敬語', firstPerson: '私', maxCharsPerUtterance: 120 }) as Persona,
    durationMin: scenario.durationMin,
  }
}
