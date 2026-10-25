// ============================================
// エージェントの実行の仕組みと、画面（UIリニューアル）との型の約束
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §3（型の約束）
// 画面の設計: docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md
// ⚠️ 画面（src/components/home-agent/）は、この型だけを見て作る。中の実装（tools.ts など）を直接呼ばない。
// ⚠️ 形を変えるときは version を上げ、両方の側に知らせる。
import type { AgentFailureKind, AgentTaskResult, AgentTaskState, AgentTaskStatus } from './runner'

export type { AgentFailureKind, AgentTaskResult, AgentTaskState, AgentTaskStatus }

/** 実行できる操作（いま動くもの）。増やすときは actions.ts の表に足す */
export type AgentActionId = 'shodan.research' | 'quote.draft' | 'slide.structure'

/** 質問（2〜4問。選択肢を主にし、文字の欄は1つまで） */
export interface AgentQuestionView {
  id: string
  label: string
  kind: 'text' | 'choice'
  options?: { value: string; label: string }[]
  placeholder?: string
  /** 最初から入れておく例（空なら入力が要る） */
  sample: string
  help?: string
}

/** 作戦の中のタスク（1つのツールの1回の作業） */
export interface AgentPlanTask {
  id: string
  action: AgentActionId
  /** src/components/shell/tools.ts のツールの id（shodan / quote / doyaslide …） */
  tool: string
  toolName: string
  title: string
  /** 何ができるか（一文） */
  makes: string
  /** 数える利用枠の説明（一文） */
  uses: string
  /** 減るドヤパワー（costs.ts の表から計算。AI に決めさせない）。減らない操作は 0 */
  power: number
  /** 所要の目安（分） */
  minutes: number
  /** 先に済んでいる必要があるタスクの id */
  after: string[]
  /** 動いている間に出す段（利用者の入力を入れた文。最後の段は「仕上げています」） */
  stages: string[]
}

export interface AgentPillar {
  id: string
  name: string
  why: string
  tasks: AgentPlanTask[]
}

/** 作戦（目的・柱・期間・タスク） */
export interface AgentPlan {
  version: 1
  /** recipe = 決まった組み合わせから作った作戦（AI を使わない）。ai = AI が作った作戦（段階2） */
  source: 'recipe' | 'ai'
  recipeId: string
  goal: string
  period: string
  pillars: AgentPillar[]
  /** 全タスクの power の合計 */
  totalPower: number
  /** 同時に動かす数の上限 */
  concurrency: number
}

/** POST /api/agent/plan の本文 */
export interface AgentPlanRequest {
  /** 利用者が書いた依頼の文 */
  text?: string
  /** 組み合わせを直接選ぶとき（チップから） */
  recipeId?: string
  /** 質問への答え。無ければ質問を返す */
  answers?: Record<string, string>
}

/** POST /api/agent/plan の答え */
export type AgentPlanResponse =
  | { kind: 'questions'; recipeId: string; title: string; lead: string; questions: AgentQuestionView[]; error?: { questionId: string; text: string } }
  | { kind: 'plan'; recipeId: string; title: string; lead: string; plan: AgentPlan; answers: Record<string, string> }
  /** どの組み合わせにも合わない（今の経営ホームの振り分けに戻す） */
  | { kind: 'none' }

/** POST /api/agent/tasks の本文（タスク1つを動かす） */
export interface AgentTaskRequest {
  recipeId: string
  taskId: string
  answers: Record<string, string>
  /** 前の失敗で残った「途中まで作れたもの」（AgentTaskState.resume をそのまま返す） */
  resume?: Record<string, string>
}

/** POST /api/agent/tasks の答え。成功は 200、失敗は 422（利用者向けの文）、旗の外は 404、入力の誤りは 400 */
export type AgentTaskResponse =
  | { result: AgentTaskResult }
  | { error: string; kind: AgentFailureKind; resume?: Record<string, string>; href?: { href: string; label: string } }
