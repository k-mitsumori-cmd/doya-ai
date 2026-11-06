// ============================================
// チャットで進める操作（ChatOp）の型
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// ⚠️ ここに並ぶのは「画面の欄を動かして進められる操作」。AI は操作の id を選び、依頼の文にある値を読み取るだけ（保存の手段は渡さない）。
// ⚠️ 保存は、ツールの画面の本物の送信処理だけが行う。本人が確認カードのボタンを押したときだけ呼ばれる。
import type { AgentField } from '@/lib/agent-router/types'

/** 操作の定義が決めた値（AI には決めさせない）。value が '@today' のときは、日本時間の今日 */
export interface ChatFixed {
  /** 画面の欄の名前（data-agent-field） */
  key: string
  value: string
  /** 作業の一覧に出す言葉（例: 種類を「単発」にする） */
  label: string
}

export interface ChatOp {
  /** 例: income.sale.add */
  key: string
  toolId: string
  /** 画面とボタンに出す言葉 */
  label: string
  /** AI に渡す説明（どんな依頼のときに選ぶか） */
  description: string
  /** 保存するか（write）、見るだけか（read）。段階1は write だけ */
  risk: 'write' | 'read'
  /** 開く画面 */
  path: string
  /** その画面のフォームが useAgentForm で登録する名前 */
  formKey: string
  /** 作業の一覧の最初の2行（ツールを開く・画面を開く） */
  openLabels: [string, string]
  /** 依頼から読み取る・聞き返す欄。この並びで画面に入れる */
  fields: AgentField[]
  /** 選ぶ欄（画面で選ぶものは、1字ずつ入れる動きにしない） */
  pickKeys: string[]
  /** 決まった値 */
  fixed: ChatFixed[]
  /** 欄ごとの作業の一覧の言葉 */
  fillLabels: Record<string, string>
  /** 確認カードの見出し・ボタン */
  confirmTitle: string
  submitLabel: string
  /** 作業の一覧の最後の行（省略すると「確認して登録する」） */
  confirmStepLabel?: string
  /**
   * 「税込みだった」の直し方。
   * divide: 入れた金額を税込みとみなし、画面の欄を 1.1 で割った税抜に直す（画面に税込みの切り替えが無いとき）
   * flag: 画面の「税込み」の切り替え（taxIncluded）を入れ、金額はそのまま
   */
  taxAdjust: 'divide' | 'flag'
  /** すでにこの画面にいるとき、開き直さない（パスの正規表現。例: ^/expense/[^/]+/contracts/new$）。省略すると path と同じかで見る */
  here?: string
  /** 今の案内（agent-router の catalog）にある同じ仕事の id。この操作が置き換える */
  replaces?: string
}

/** 画面（フォーム）が答える、今の欄の値。数字は桁区切りなしの文字列 */
export type AgentFormSnapshot = Record<string, string>

export type StepStatus = 'wait' | 'run' | 'done'
export interface StepView { id: string; label: string; status: StepStatus }

/** 完了のあとに出す「次のおすすめ」 */
export interface NextAction {
  id: string
  label: string
  hint: string
  /** 開く画面。prefill があれば、値を一度きりの鍵で渡す（今の useDoyaPrefill の方法） */
  href: string
  prefill?: Record<string, string>
}

export interface ConfirmRow { label: string; value: string; big?: boolean }

/** API が返す形（op は定義の写し） */
export type ChatOpResponse = {
  kind: 'op'
  op: ChatOp
  values: Record<string, string>
  missing: AgentField[]
  say: string
}

/** API が返す、チャットの操作でない答え（今の /api/agent/route と同じ形）も合わせた全体 */
export type ChatApiResponse = ChatOpResponse | import('@/lib/agent-router/types').AgentRouteResponse
