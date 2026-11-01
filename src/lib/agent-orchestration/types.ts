// ============================================
// エージェントの実行の仕組みと、画面（UIリニューアル）との型の約束
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §3（型の約束）
// 画面の設計: docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md（§3 画面の流れ・§5 作戦）
// ⚠️ 画面（src/components/home-agent/）は、この型だけを見て作る。中の実装（tools.ts など）を直接呼ばない。
//    画面で使ってよい関数は view.ts の todoViewOf・todoCounts と、runner.ts の runAgentTasks・progressOf だけ。
// ⚠️ 形を変えるときは AGENT_CONTRACT_VERSION を上げ、両方の側に知らせる。
import type { AgentDraftDetail, AgentFailureAction, AgentFailureKind, AgentPowerUse, AgentStates, AgentTaskResult, AgentTaskState, AgentTaskStatus } from './runner'

export type { AgentDraftDetail, AgentFailureAction, AgentFailureKind, AgentPowerUse, AgentTaskResult, AgentTaskState, AgentTaskStatus }

export const AGENT_CONTRACT_VERSION = 2 as const

/** 実行できる操作（いま動くもの）。増やすときは plan.ts の ACTION_CATALOG に足す */
export type AgentActionId = 'shodan.research' | 'quote.draft' | 'slide.structure'

/* ---------------- 1. 分析の材料 ---------------- */

/** 材料の種類。request=依頼と答え / company=登録会社 / tools=使うツールの準備 / power=ドヤパワーの残り / history=前回の作戦 */
export type AgentSourceKind = 'request' | 'company' | 'tools' | 'power' | 'history'

/** 分析の場面で、1枚の札に出す材料 */
export interface AgentSourceView {
  id: string
  kind: AgentSourceKind
  /** 札の名前（例: 「登録会社の情報」） */
  label: string
  /** reading=読んでいる / read=読んだ / skipped=読めなかった・使わない（作戦は止めない） */
  status: 'reading' | 'read' | 'skipped'
  /** 読んだ結果の一文（例: 「サンプル株式会社（Web制作）」）。reading のときは無い */
  note?: string
}

/* ---------------- 2・3. 理由とゴール ---------------- */

/** ゴール（今・ゴール・差）。数は Number Ticker でそのまま数え上げられる整数 */
export interface AgentGoalView {
  /** ゴールの一文（例: 「example.co.jp との提案の場に、資料をそろえて臨む」） */
  statement: string
  /** 期間（例: 「今日」「4週間」） */
  period: string
  /** 数の単位（例: 「点」「件」） */
  unit: string
  /** 何を数えるか（例: 「商談の資料」） */
  measure: string
  now: number
  target: number
  /** target − now（0 より小さくしない） */
  gap: number
}

/* ---------------- 4. 柱と ToDo ---------------- */

/** ToDo を始められるか（ツールの組織が無いなど、先に人がすることがあれば ok: false） */
export interface AgentReadiness {
  ok: boolean
  /** 始められない理由の一文 */
  reason?: string
  /** 先にすることの画面（中の画面だけ） */
  href?: string
  hrefLabel?: string
}

/** 作戦の中の ToDo（1つのツールの1回の作業） */
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
  /** 先に済んでいる必要がある ToDo の id */
  after: string[]
  /** 動いている間に出す段（利用者の入力を入れた文。最後の段は「…仕上げています」） */
  stages: string[]
  /** ドヤくんに任せられるか（false は人がする ToDo。実行しない） */
  delegable: boolean
  /** 「ドヤくんに任せる」の最初の値（画面で外せる） */
  delegate: boolean
  /** 始められるか */
  ready: AgentReadiness
}

/** 柱（チームのゴール） */
export interface AgentPillar {
  id: string
  name: string
  /** この柱を置く理由 */
  why: string
  /** チームのゴールの一文（例: 「相手の事業と最近の動きを、3行で話せる」） */
  teamGoal: string
  tasks: AgentPlanTask[]
}

/** 作戦（ゴール・理由・柱・ToDo） */
export interface AgentPlan {
  version: typeof AGENT_CONTRACT_VERSION
  /** recipe = 決まった組み合わせから作った作戦（AI を使わない）。ai = AI が作った作戦（段階2） */
  source: 'recipe' | 'ai'
  recipeId: string
  goal: AgentGoalView
  /** 考えたことの行（Blur Text / Text Effect で1行ずつ出す。3〜5行） */
  reasons: string[]
  pillars: AgentPillar[]
  /** 任せる（delegate）ToDo の power の合計。画面でチェックを外したら、画面で計算し直す */
  totalPower: number
  /** 同時に動かす数の上限 */
  concurrency: number
}

/** 確かめの欄に出すドヤパワーの残り。旗の外・会社が未登録・読めないときは enabled: false */
export interface AgentPowerView {
  enabled: boolean
  remaining: number | null
  /** 次の回復の時刻（ISO 8601）。無ければ null */
  nextRecoveryAt: string | null
}

/* ---------------- API: 作戦 ---------------- */

/** POST /api/agent/plan の本文 */
export interface AgentPlanRequest {
  /** 利用者が書いた依頼の文 */
  text?: string
  /** 組み合わせを直接選ぶとき（チップから） */
  recipeId?: string
  /** 質問への答え。無ければ質問を返す */
  answers?: Record<string, string>
}

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

/** POST /api/agent/plan の答え */
export type AgentPlanResponse =
  | { kind: 'questions'; recipeId: string; title: string; lead: string; questions: AgentQuestionView[]; error?: { questionId: string; text: string } }
  | { kind: 'plan'; recipeId: string; title: string; lead: string; plan: AgentPlan; sources: AgentSourceView[]; power: AgentPowerView; answers: Record<string, string> }
  /** どの組み合わせにも合わない（今の経営ホームの振り分けに戻す） */
  | { kind: 'none' }

/**
 * POST /api/agent/plan を Accept: application/x-ndjson で呼んだときに、1行ずつ届く知らせ。
 * - source: 材料を読み始めた（status: reading）・読み終えた（read / skipped）。同じ id の札を上書きする
 * - reason: 考えたことの1行
 * - result: 最後の答え（AgentPlanResponse と同じ）。これで終わる
 * - error: 作戦を作れなかった。これで終わる
 * 材料は同時に読むので、source の read は読み終えた順に届く（作り話の進み具合は出さない）。
 */
export type AgentPlanEvent =
  | { type: 'source'; source: AgentSourceView }
  | { type: 'reason'; text: string }
  | { type: 'result'; response: AgentPlanResponse }
  /** 作戦を作れなかった（利用者向けの一文）。これで終わる */
  | { type: 'error'; text: string }

/* ---------------- API: ToDo の実行 ---------------- */

/** POST /api/agent/tasks の本文（ToDo を1つ動かす） */
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
  | { error: string; kind: AgentFailureKind; resume?: Record<string, string>; href?: { href: string; label: string }; power?: AgentPowerUse; cause?: string; actions?: AgentFailureAction[] }

/* ---------------- 5. ToDo の実行の状態（画面の札） ---------------- */

/** 画面の4つの状態。waiting=待つ / running=進む / done=できた / failed=失敗した（減った分は戻した） */
export type AgentTodoStatus = 'waiting' | 'running' | 'done' | 'failed'

/** できた下書き */
export interface AgentDraftView {
  summary: string
  points: string[]
  /** 各ツールの画面で下書きを開くリンク */
  href: string
  hrefLabel: string  /** できた物の中身（無いときは points だけを出す） */
  detail?: AgentDraftDetail
}

/** 1つの ToDo の札に出すもの（view.ts の todoViewOf が runner の状態から作る） */
export interface AgentTodoView {
  id: string
  status: AgentTodoStatus
  /** 今の段（stages の何番目か。running のときだけ。0 から） */
  stage: number | null
  /**
   * 減ったドヤパワーと、戻したドヤパワー（試みごとに足した量。減る量の表から数えた目安）。
   * 失敗の文の出し分け: used > 0 なら「N 減りました（途中まで作れた分）」、used が 0 で refunded > 0 なら「減った分（N）は戻しました」、
   * どちらも 0 なら「ドヤパワーは減っていません」。ただし powerKnown が false のときは、量を言わない（通信が切れて答えが届かなかった）
   */
  power: AgentPowerUse
  /** 量が分かっているか（サーバーの答えが一度でも届いた）。false のときは、減ったかどうかを言わない */
  powerKnown: boolean
  draft?: AgentDraftView
  /** 失敗の一文と、開くとよい画面 */
  /**
   * 失敗の文（何が原因で、どうすればよいか）と、次の一手（actions）。
   * actions の input（会社名を入れてやり直す）は、入れた値を resume に { companyName } で足してやり直す
   */
  error?: { text: string; kind: AgentFailureKind; href?: string; hrefLabel?: string; cause?: string; actions: AgentFailureAction[] }
  /** やり直せるか（failed のとき） */
  retryable: boolean
  attempts: number
}

/* ---------------- 実行の記録（旗 AGENT_RUNS_STORE=db のときだけ。DESIGN.md §8） ---------------- */

/** 実行の全体の状態。planned=まだ動かしていない / running=動いている / done=すべて済んだ / partial=済んでいない ToDo が残った / canceled=やめた */
export type AgentRunStatus = 'planned' | 'running' | 'done' | 'partial' | 'canceled'

/** 保存した実行（「続きを進める」に使う） */
export interface AgentRunView {
  id: string
  recipeId: string
  title: string
  plan: AgentPlan
  answers: Record<string, string>
  status: AgentRunStatus
  /** 任せた ToDo の id */
  delegated: string[]
  /** 任せた ToDo のうち、まだ済んでいないもの（「続きを進める」で動かすもの） */
  remaining: string[]
  /** runner の状態（runAgentTasks の prev にそのまま渡す。todoViews にも渡せる） */
  states: AgentStates
  /** この実行で減った・戻したドヤパワーの合計 */
  power: AgentPowerUse
  createdAt: string
  updatedAt: string
}

/** POST /api/agent/runs の本文（作戦を保存して、実行を作る） */
export interface AgentRunCreateRequest {
  recipeId: string
  answers: Record<string, string>
  /** ドヤくんに任せる ToDo の id（画面のチェック） */
  delegate: string[]
  /** 依頼の文（記録に残す） */
  text?: string
}

/**
 * 記録の API の答え
 * - POST /api/agent/runs → 201 { run }
 * - GET /api/agent/runs/active → 200 { run }（無ければ run: null）
 * - POST /api/agent/runs/[id]/tasks/[taskId] → 200 { result, run } / 422 { error, kind, resume?, href?, power?, run? }
 * - 記録を使わない設定（AGENT_RUNS_STORE が db でない）→ 404 { error, store: 'off' }（画面は端末に残す形に戻す）
 */
export type AgentRunResponse = { run: AgentRunView | null }
