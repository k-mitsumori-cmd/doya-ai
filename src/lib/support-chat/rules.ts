// ============================================
// サポートチャットの「運営へ渡す」判定（純粋な関数）
// ============================================
// AI より先にこの判定を通す。AI の答えにも同じ判定をかける（設計書 4.2）。
// ⚠️ 迷ったら運営へ渡す側に倒す。言葉の一覧は、届いた質問を見て足していく。
import type { SlackSeverity } from '@/lib/slack/notify'

export type SupportCategory =
  | 'howto'      // 使い方
  | 'bug'        // 不具合
  | 'billing'    // 支払い
  | 'cancel'     // 解約
  | 'data'       // データの削除
  | 'complaint'  // クレーム
  | 'consult'    // 個別の相談
  | 'security'   // 情報の漏れ・不正利用
  | 'other'

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  howto: '使い方',
  bug: '不具合',
  billing: '支払い',
  cancel: '解約',
  data: 'データの削除',
  complaint: 'ご不満・クレーム',
  consult: '個別のご相談',
  security: '不正利用・情報の漏れ',
  other: 'その他',
}

/** 「運営に伝える」の画面で選べる分類（並び順） */
export const SUPPORT_CATEGORY_CHOICES: SupportCategory[] = ['howto', 'bug', 'billing', 'cancel', 'data', 'complaint', 'consult', 'security', 'other']

/** 運営が必ず対応する分類（AI は答えない） */
export const STAFF_ONLY: ReadonlySet<SupportCategory> = new Set(['bug', 'billing', 'cancel', 'data', 'complaint', 'consult', 'security'])

/** 分類ごとの Slack の重さ。情報の漏れ・不正利用だけ緊急（@channel） */
export function severityOf(category: SupportCategory): SlackSeverity {
  if (category === 'security') return 'urgent'
  return 'action'
}

// 上にあるものほど先に当てる。重い方から順に見る:
// 不正 → クレーム → 支払い → 解約 → データの削除 → 不具合 → 個別の相談
const RULES: Array<{ category: SupportCategory; words: RegExp }> = [
  { category: 'security', words: /(乗っ取|不正(利用|ログイン|アクセス)|なりすまし|情報(が|の)?(漏|流出)|漏えい|漏洩|ハッキング|身に覚えのない)/ },
  { category: 'complaint', words: /(クレーム|ひどい|最悪|ふざけ|詐欺|訴え|弁護士|消費者センター|責任者|謝罪|誠意|対応が(悪|遅)|二度と使わ|怒)/ },
  { category: 'billing', words: /(請求|領収書|インボイス|返金|返済|引き落と|カード(の|を|が)|クレジット|二重(に|で)?(請求|課金)|課金され|決済(が|に|で)|支払(い|う|え)|お金が|料金が(おかし|違)|払い戻)/ },
  { category: 'cancel', words: /(解約|退会|やめたい|辞めたい|止めたい|サブスク(を|の)?(停止|止め)|契約(を|の)?(終了|解除|停止))/ },
  { category: 'data', words: /(データ(を|の)?(削除|消し|消去)|個人情報(を|の)?(削除|消)|アカウント(を|の)?削除|消してほしい|消してください|開示請求)/ },
  { category: 'bug', words: /(動かない|使えない|エラー|不具合|バグ|落ちる|固ま(る|った)|真っ白|表示されない|読み込(み|め)(が|ない|終わらない)|ログインできない|保存できない|生成(が|でき)?(失敗|できない|止ま)|(^|[^0-9])(500|404)([^0-9]|$))/ },
  { category: 'consult', words: /(見積(り|もり)?|請求書払い|導入(の|を)?(相談|検討)|契約(の|を)?(変更|相談)|法人(契約|プラン)|担当者|打ち合わせ|商談|営業の方|電話(で|を)?(相談|ください))/ },
]

/** 入力の文から分類を決める。当たらなければ null（AI が答えてよい質問） */
export function classifyMessage(text: string): SupportCategory | null {
  const t = (text || '').normalize('NFKC')
  for (const r of RULES) if (r.words.test(t)) return r.category
  return null
}

export type RouteDecision =
  | { route: 'answer' }
  | { route: 'staff'; category: SupportCategory; reason: string }

/** 質問を AI に答えさせるか、運営へ渡すか */
export function routeQuestion(text: string): RouteDecision {
  const category = classifyMessage(text)
  if (category && STAFF_ONLY.has(category)) {
    return { route: 'staff', category, reason: `${SUPPORT_CATEGORY_LABEL[category]}のご相談は、運営の担当者がお答えします。` }
  }
  return { route: 'answer' }
}

/**
 * AI（モックを含む）の答えに、運営へ渡す話が入っていないか。
 * 答えが支払いや解約の手続きを案内しはじめたら、答えを出さずに運営へ渡す。
 */
export function answerNeedsStaff(answer: string): SupportCategory | null {
  const t = (answer || '').normalize('NFKC')
  if (/(返金(します|いたします|できます)|請求を取り消|返金を(受け付け|承り))/.test(t)) return 'billing'
  if (/解約を(受け付け|承り|完了)|解約しました/.test(t)) return 'cancel'
  if (/データを(削除|消去)(しました|します|いたします)/.test(t)) return 'data'
  return null
}
