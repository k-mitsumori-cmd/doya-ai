// ============================================
// 経営ホームの「ドヤAIに頼む」：依頼を読んで、ツールと操作を選ぶ仕組みの型
// ============================================
// 2026-10-28 本人の指示（メイン経由）:
//   入力された依頼を AI が読み、全ツールの中から「どのツールのどの操作か」を選ぶ。
//   読み取れた値（金額・日付・相手・件名など）を入れた状態で、そのツールの画面を保存や送信の直前まで進める。
//   最後の保存・送信は利用者が押す。足りない値は1つずつ聞く。複数の手順が要る依頼だけ「作戦」に回す。
//   キーワードの決め打ちの表ではなく、AI で選ぶ（判定は強いモデル）。
// ⚠️ ここに並ぶのは「ツールにできる操作の一覧」（AI に渡す選択肢）であって、言葉の一致の表ではない。

/** 操作に入れる値の種類。画面に渡す前に、種類ごとに形を確かめる */
export type AgentFieldType = 'text' | 'longtext' | 'url' | 'yen' | 'date' | 'email' | 'number'

export interface AgentField {
  /** URL で渡すときの名前（doya_ を付けて渡す。例: amount → ?doya_amount=） */
  key: string
  /** 画面の言葉（足りないときに聞く文にも使う） */
  label: string
  type: AgentFieldType
  /** これが無いと、画面を開いても進められない値（足りなければ1つずつ聞く） */
  required?: boolean
  /** AI に渡す説明（何を入れる欄か） */
  hint?: string
  /** 足りないときに聞く文（無ければ「{label}を教えてください」） */
  ask?: string
}

export interface AgentAction {
  /** 例: expense.contract.create */
  id: string
  /** services.ts / tools.ts のツールの id */
  toolId: string
  /** 画面とボタンに出す言葉（例: 支出の契約を登録する） */
  label: string
  /** AI に渡す説明（どんな依頼のときに選ぶか） */
  description: string
  /** 開く画面（値は doya_<key> を足して渡す）。組織の中の画面は、入口（例: /expense?to=…）から運ぶ */
  path: string
  fields: AgentField[]
  /** 最後に利用者が押すもの（例: 「保存する」）。案内の文に使う */
  finalStep: string
}

/** AI が選んだ結果（サーバーで確かめたあと） */
export type AgentRoute =
  | { kind: 'action'; actionId: string; values: Record<string, string>; missing: string[]; reason: string }
  | { kind: 'plan'; reason: string }
  | { kind: 'unknown'; reason: string; suggestions: string[] }

/** API が返す形（画面はこれだけを見る） */
export type AgentRouteResponse =
  | { kind: 'action'; action: { id: string; toolId: string; label: string; finalStep: string; fields: AgentField[] }; values: Record<string, string>; missing: AgentField[]; href: string; reason: string }
  | { kind: 'plan'; planId: string; reason: string }
  | { kind: 'unknown'; reason: string; suggestions: { label: string; href: string }[] }
  | { kind: 'limited'; reason: string }
