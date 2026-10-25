// ============================================
// ミッションの画面に出すものを、記録から組み立てる（純粋関数）
// ============================================
// load.server.ts（DB から読む）と、見本のデータのプレビューの両方がここを通す。
import { monthlyAchievements, type AchievementKind, type MonthlyAchievements } from './achievements'
import { jstMonthKey } from './jst'
import { dailyMissionState, onboardingQuests, projectAwards, questStates, MONTHLY_CAP, type DailyMissionState, type QuestFacts, type QuestState } from './rules'

export interface MissionsInput {
  companyName: string | null
  facts: QuestFacts
  counts: Partial<Record<AchievementKind, number>>
  /** どのツールの記録を読めたか（読めないツールのミッションは「まだ使っていない」と出す） */
  tools: { quote: boolean; sfa: boolean }
}

export interface MissionsView {
  generatedAt: string
  companyName: string | null
  daily: DailyMissionState
  quests: QuestState[]
  /** 記録から出したドヤパワーの見込み（台帳ができるまで） */
  power: { thisMonth: number; cap: number }
  achievements: MonthlyAchievements
  tools: { quote: boolean; sfa: boolean }
}

/** newPricing: 新しい料金（旗 NEW_PRICING_ROLLOUT）の対象の人か。はじめの手順の報酬の表が変わる（off なら今の値） */
export function buildMissionsView(input: MissionsInput, now: Date | number, opts: { newPricing?: boolean } = {}): MissionsView {
  const quests = onboardingQuests(opts.newPricing === true)
  const projected = projectAwards(input.facts, now, MONTHLY_CAP, quests)
  return {
    generatedAt: new Date(now).toISOString(),
    companyName: input.companyName,
    daily: dailyMissionState(input.facts.actions, now),
    quests: questStates(input.facts, quests),
    power: { thisMonth: projected.thisMonth, cap: projected.cap },
    achievements: monthlyAchievements(jstMonthKey(now) ?? '', input.counts),
    tools: input.tools,
  }
}
