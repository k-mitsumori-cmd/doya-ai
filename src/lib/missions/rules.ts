// ============================================
// 今日のミッション・はじめの手順のクエスト・月の上限
// ============================================
// ドヤパワーを「付与してよいか」「いくつ付与するか」を決める純粋関数。
// ⚠️ ここでは付与しない（DB に書かない）。付与は台帳（ui-next/doyapower-ledger）が、decideAward() の結果に従って行う。
// ⚠️ 報酬は小さく、人の操作に付ける（AI の生成には付けない。判定は actions.ts）。
// ⚠️ 日付と月は日本時間（jst.ts）。
import { isMeaningfulAction, notCountedReason, MIN_ACTIVITY_CHARS, type MissionAction, type MissionActionKind } from './actions'
import { jstDateKey, jstMonthKey } from './jst'

/** 会社ごとの、ひと月の上限（ミッション・クエスト・ボーナスの合計） */
export const MONTHLY_CAP = 200

/** 今日のミッションの報酬（1日1回まで） */
export const DAILY_MISSION_REWARD = 10

// ---- 今日のミッション ----

export interface DailyMission {
  id: string
  title: string
  /** 何をすれば達成か（画面に出す） */
  condition: string
  kinds: MissionActionKind[]
  href: string
}

/**
 * 今日のミッションの候補。どれか1つを終えれば、その日は達成（報酬は1日1回）。
 * ⚠️ AI が作るだけで終わる操作（記事・画像の生成）は入れない。
 */
export const DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'log_activity',
    title: '商談の記録を1件残す',
    condition: `電話・打ち合わせ・メールの記録を、${MIN_ACTIVITY_CHARS}文字以上の本文つきで保存する（文字起こしからの記録は数えません）`,
    kinds: ['activity_logged'],
    href: '/sfa',
  },
  {
    id: 'issue_quote',
    title: '見積を1件発行する',
    condition: '件名・宛先の会社・金額のある品目を入れて、確定か送付をする',
    kinds: ['quote_issued'],
    href: '/quote',
  },
  {
    id: 'save_deal',
    title: '商談を1件登録する',
    condition: '商談の名前・金額・完了予定日を入れて保存する',
    kinds: ['deal_saved'],
    href: '/sfa',
  },
  {
    id: 'win_deal',
    title: '受注を1件記録する',
    condition: '金額の入った商談を受注にする',
    kinds: ['deal_won'],
    href: '/sfa',
  },
]

export interface DailyMissionState {
  dateKey: string
  done: boolean
  /** 達成にした操作（その日の最初の、数える操作） */
  doneBy: { missionId: string; actionId: string; at: string } | null
  missions: (DailyMission & { done: boolean })[]
  /** 今日の操作のうち、数えなかったもの（理由つき）。画面で「なぜ数えないか」を見せる */
  notCounted: { kind: MissionActionKind; id: string; reason: string }[]
  reward: number
}

/** 候補の並びを日ごとに回す（毎日同じ順で並ばないように）。日付が同じなら同じ順 */
export function missionsForDay(dateKey: string, missions: DailyMission[] = DAILY_MISSIONS): DailyMission[] {
  const n = Number(dateKey.replace(/-/g, '')) || 0
  const shift = n % missions.length
  return [...missions.slice(shift), ...missions.slice(0, shift)]
}

function missionFor(kind: MissionActionKind, missions: DailyMission[]): DailyMission | undefined {
  return missions.find((m) => m.kinds.includes(kind))
}

/** 今日（日本時間）のミッションの状態。actions は会社の操作（日付はばらばらでよい） */
export function dailyMissionState(actions: MissionAction[], now: Date | number): DailyMissionState {
  const dateKey = jstDateKey(now) ?? ''
  const today = actions
    .filter((a) => jstDateKey(a.at) === dateKey)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const counted = today.filter(isMeaningfulAction)
  const first = counted[0]
  const firstMission = first ? missionFor(first.kind, DAILY_MISSIONS) : undefined
  return {
    dateKey,
    done: Boolean(first && firstMission),
    doneBy: first && firstMission ? { missionId: firstMission.id, actionId: first.id, at: first.at } : null,
    missions: missionsForDay(dateKey).map((m) => ({ ...m, done: counted.some((a) => m.kinds.includes(a.kind)) })),
    notCounted: today
      .map((a) => ({ kind: a.kind, id: a.id, reason: notCountedReason(a) }))
      .filter((x): x is { kind: MissionActionKind; id: string; reason: string } => x.reason !== null),
    reward: DAILY_MISSION_REWARD,
  }
}

// ---- はじめの手順のクエスト（会社ごとに1回だけ） ----

export interface QuestFacts {
  /** 登録した会社（AccountCompany） */
  company: { name: string; industry: string | null; websiteUrl: string | null; at: string } | null
  /** 招待を受けて入ったメンバー（招待しただけ・まだ入っていない人は数えない） */
  acceptedInvites: { at: string }[]
  /** 会社の操作（いつのものでもよい）。最初の見積・最初の記録に使う */
  actions: MissionAction[]
}

export type QuestId = 'company_profile' | 'invite_member' | 'first_quote' | 'first_activity'

export interface Quest {
  id: QuestId
  title: string
  condition: string
  reward: number
  href: string
}

export const ONBOARDING_QUESTS: Quest[] = [
  { id: 'company_profile', title: '会社情報を登録する', condition: '会社名と、業種かサイトの URL を登録する', reward: 50, href: '/home' },
  { id: 'invite_member', title: 'メンバーを招待する', condition: '招待した人が参加する（招待を送っただけでは数えません）', reward: 100, href: '/sfa' },
  { id: 'first_quote', title: '最初の見積を発行する', condition: '中身の入った見積を、確定か送付する', reward: 30, href: '/quote' },
  { id: 'first_activity', title: '最初の商談の記録を残す', condition: '本文のある商談の記録を保存する', reward: 20, href: '/sfa' },
]

export interface QuestState extends Quest {
  done: boolean
  /** 達成した日時（分かるとき） */
  doneAt: string | null
}

function firstCounted(actions: MissionAction[], kind: MissionActionKind): MissionAction | undefined {
  return actions
    .filter((a) => a.kind === kind && isMeaningfulAction(a))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
}

/** クエストごとの達成と、その日時 */
export function questDoneAt(id: QuestId, f: QuestFacts): string | null {
  switch (id) {
    case 'company_profile': {
      const c = f.company
      const ok = c && c.name.trim().length > 0 && Boolean((c.industry ?? '').trim() || (c.websiteUrl ?? '').trim())
      return ok ? c.at : null
    }
    case 'invite_member': {
      const first = [...f.acceptedInvites].filter((i) => Number.isFinite(Date.parse(i.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
      return first?.at ?? null
    }
    case 'first_quote':
      return firstCounted(f.actions, 'quote_issued')?.at ?? null
    case 'first_activity':
      return firstCounted(f.actions, 'activity_logged')?.at ?? null
  }
}

export function questStates(f: QuestFacts): QuestState[] {
  return ONBOARDING_QUESTS.map((q) => {
    const doneAt = questDoneAt(q.id, f)
    return { ...q, done: doneAt !== null, doneAt }
  })
}

// ---- 付与してよいか（台帳が使う） ----

/** 付与の記録（台帳の1行に相当） */
export interface AwardEntry {
  /** 同じ key は2回付与しない（quest:<id> / daily:<YYYY-MM-DD> / bonus:<id>） */
  key: string
  amount: number
  at: string
}

export type AwardRequest =
  | { type: 'daily'; action: MissionAction }
  | { type: 'quest'; questId: QuestId; facts: QuestFacts }
  /** 運営からのボーナスなど。上限の中で数える */
  | { type: 'bonus'; id: string; amount: number }

export type AwardDecision =
  | { ok: true; key: string; amount: number; /** 上限に当たって減らしたか */ clamped: boolean }
  | { ok: false; key: string | null; reason: 'not_counted' | 'not_done' | 'already_awarded' | 'monthly_cap' | 'invalid'; message: string }

/** その月（日本時間）に、この会社がもう受け取った合計 */
export function monthTotal(ledger: AwardEntry[], monthKey: string): number {
  return ledger.filter((e) => jstMonthKey(e.at) === monthKey).reduce((sum, e) => sum + Math.max(0, e.amount), 0)
}

/**
 * 付与してよいか、いくつ付与するか。ledger はこの会社の付与の記録だけを渡す。
 * - 同じ key は2回付与しない（今日のミッションは日本時間の1日1回、クエストは会社ごとに1回）
 * - ひと月の合計が cap を超えないように減らす。残りが0なら付与しない
 */
export function decideAward(req: AwardRequest, ledger: AwardEntry[], now: Date | number, cap: number = MONTHLY_CAP): AwardDecision {
  const at = new Date(now).toISOString()
  let key: string
  let amount: number
  if (req.type === 'daily') {
    const reason = notCountedReason(req.action)
    const dateKey = jstDateKey(req.action.at)
    if (reason || !dateKey) return { ok: false, key: null, reason: 'not_counted', message: reason ?? '日時を読み取れません' }
    if (dateKey !== jstDateKey(now)) return { ok: false, key: null, reason: 'invalid', message: '今日の操作ではありません' }
    key = `daily:${dateKey}`
    amount = DAILY_MISSION_REWARD
  } else if (req.type === 'quest') {
    const q = ONBOARDING_QUESTS.find((x) => x.id === req.questId)
    if (!q) return { ok: false, key: null, reason: 'invalid', message: 'クエストが見つかりません' }
    key = `quest:${q.id}`
    if (questDoneAt(q.id, req.facts) === null) return { ok: false, key, reason: 'not_done', message: 'まだ達成していません' }
    amount = q.reward
  } else {
    if (!req.id || !Number.isInteger(req.amount) || req.amount <= 0) return { ok: false, key: null, reason: 'invalid', message: 'ボーナスの中身が正しくありません' }
    key = `bonus:${req.id}`
    amount = req.amount
  }
  if (ledger.some((e) => e.key === key)) return { ok: false, key, reason: 'already_awarded', message: 'もう受け取っています' }
  const remaining = Math.max(0, cap - monthTotal(ledger, jstMonthKey(at) ?? ''))
  if (remaining <= 0) return { ok: false, key, reason: 'monthly_cap', message: `今月の上限（${cap}）に届いています` }
  const granted = Math.min(amount, remaining)
  return { ok: true, key, amount: granted, clamped: granted < amount }
}

/**
 * 付与の依頼を時刻の順に decideAward() に通し、付与の記録を作る（見込みの計算とテストに使う）。
 * ⚠️ DB には書かない。
 */
export function applyAwards(requests: { req: AwardRequest; at: string }[], ledger: AwardEntry[] = [], cap: number = MONTHLY_CAP): AwardEntry[] {
  const out = [...ledger]
  for (const { req, at } of [...requests].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const d = decideAward(req, out, Date.parse(at), cap)
    if (d.ok) out.push({ key: d.key, amount: d.amount, at })
  }
  return out
}

/**
 * 記録から、ドヤパワーの見込みを出す（台帳ができるまでの表示用）。
 * クエストは達成した日時、今日のミッションは各日の最初の数える操作の日時で付与したとみなす。
 */
export function projectAwards(facts: QuestFacts, now: Date | number, cap: number = MONTHLY_CAP): { ledger: AwardEntry[]; thisMonth: number; cap: number } {
  const nowMs = new Date(now).getTime()
  const requests: { req: AwardRequest; at: string }[] = []
  for (const q of questStates(facts)) {
    if (q.doneAt && Date.parse(q.doneAt) <= nowMs) requests.push({ req: { type: 'quest', questId: q.id, facts }, at: q.doneAt })
  }
  const seenDays = new Set<string>()
  for (const a of [...facts.actions].sort((x, y) => Date.parse(x.at) - Date.parse(y.at))) {
    const d = jstDateKey(a.at)
    if (!d || seenDays.has(d) || Date.parse(a.at) > nowMs || !isMeaningfulAction(a)) continue
    seenDays.add(d)
    requests.push({ req: { type: 'daily', action: a }, at: a.at })
  }
  const ledger = applyAwards(requests, [], cap)
  return { ledger, thisMonth: monthTotal(ledger, jstMonthKey(nowMs) ?? ''), cap }
}
