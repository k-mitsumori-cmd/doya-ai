// ============================================
// ミッションで数える「意味のある操作」
// ============================================
// 数えるのは、人が中身を入れて保存・送信・発行したものだけ。
// - 空の見積・題名だけの記録・金額0の商談のような、量産できる操作は数えない
// - AI が作ったもの（文字起こしからの記録など）は数えない。報酬は人の操作に付ける
// ⚠️ ここは純粋関数だけ。DB から読んで MissionAction に詰めるのは load.server.ts。
//    ドヤパワーの台帳（ui-next/doyapower-ledger）も、付与の前にこの判定を通す想定。

export type MissionAction =
  | {
      /** 見積を発行した（確定か送付。どちらも人の明示の操作） */
      kind: 'quote_issued'
      id: string
      at: string
      title: string
      clientCompany: string | null
      totalExclTax: number
      lines: { itemName: string; qty: number; unitPrice: number }[]
    }
  | {
      /** 商談の記録（電話・打ち合わせ・メール・メモ）を保存した */
      kind: 'activity_logged'
      id: string
      at: string
      type: string
      subject: string | null
      body: string | null
      /** 文字起こしや AI の要約から作られたか */
      aiGenerated: boolean
    }
  | {
      /** 商談を登録した（金額と完了予定日まで入っているもの） */
      kind: 'deal_saved'
      id: string
      at: string
      name: string
      amount: number
      expectedCloseDate: string | null
    }
  | {
      /** 商談を受注にした */
      kind: 'deal_won'
      id: string
      at: string
      name: string
      amount: number
    }

export type MissionActionKind = MissionAction['kind']

/** 中身が無いとみなす題名（仮の名前のまま保存したもの） */
const PLACEHOLDER_TITLES = ['無題', '新規', '新規見積', '見積', '見積書', 'test', 'テスト', 'あ', 'aaa', '-', 'なし']

const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'note']

/** 記録の本文として数える最低の文字数（空白を除く）。一言だけのメモは数えない */
export const MIN_ACTIVITY_CHARS = 20

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, '').trim()
}

function isPlaceholder(s: string | null | undefined): boolean {
  const v = clean(s).toLowerCase()
  return v.length === 0 || PLACEHOLDER_TITLES.includes(v)
}

/** 同じ文字の繰り返し（「ああああ」「1111」）ではない、ふつうの文か */
function looksLikeText(s: string, minChars: number): boolean {
  if (s.length < minChars) return false
  return new Set(Array.from(s)).size >= 5
}

/**
 * 数えない理由。数えるときは null。
 * 理由の文は画面（「数えなかった操作」）とテストで使う。
 */
export function notCountedReason(a: MissionAction): string | null {
  if (!a.id || !Number.isFinite(Date.parse(a.at))) return '日時を読み取れません'
  switch (a.kind) {
    case 'quote_issued': {
      if (isPlaceholder(a.title)) return '見積の件名が入っていません'
      if (isPlaceholder(a.clientCompany)) return '宛先の会社が入っていません'
      const filled = a.lines.filter((l) => !isPlaceholder(l.itemName) && l.qty > 0 && l.unitPrice > 0)
      if (filled.length === 0) return '品目と金額が入っていません'
      if (!(a.totalExclTax > 0)) return '合計が0円です'
      return null
    }
    case 'activity_logged': {
      if (a.aiGenerated) return 'AI が作った記録は数えません'
      if (!ACTIVITY_TYPES.includes(a.type)) return '記録の種類を読み取れません'
      const text = clean(a.subject) + clean(a.body)
      if (!looksLikeText(text, MIN_ACTIVITY_CHARS)) return `記録の中身が短すぎます（${MIN_ACTIVITY_CHARS}文字から）`
      return null
    }
    case 'deal_saved': {
      if (isPlaceholder(a.name)) return '商談の名前が入っていません'
      if (!(a.amount > 0)) return '商談の金額が入っていません'
      if (!a.expectedCloseDate || !Number.isFinite(Date.parse(a.expectedCloseDate))) return '完了予定日が入っていません'
      return null
    }
    case 'deal_won': {
      if (isPlaceholder(a.name)) return '商談の名前が入っていません'
      if (!(a.amount > 0)) return '受注の金額が入っていません'
      return null
    }
  }
}

export function isMeaningfulAction(a: MissionAction): boolean {
  return notCountedReason(a) === null
}
