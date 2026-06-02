// ============================================
// ドヤカンニング モードレジストリ
// ============================================
// ビジネス（商談/面接）＋エンタメ（アイドル神対応/アンチ返し/配信トーク）を一元定義。
// 新モードはここに1エントリ足すだけで、回答生成・事前準備・トリガー・UIが追従する。
import type { CunningMode } from './types'

export type ModeCategory = 'business' | 'entertainment'
export type ModeContext = 'knowledge' | 'company' | 'none'
export type ModeTrigger = 'question' | 'any'

export interface ModeDef {
  id: CunningMode
  label: string
  icon: string // emoji
  category: ModeCategory
  desc: string
  /** question=相手の質問を検出して回答 / any=相手の発話・コメント全般に反応 */
  trigger: ModeTrigger
  /** knowledge=商談ナレッジRAG / company=企業×応募者 / none=コンテキスト不要 */
  context: ModeContext
  manualPlaceholder: string
  /** 入力（相手の発話）の呼び名 */
  inputLabel: string
  /** summary/script の意味づけ（出力指示に使う） */
  outputHint: { summary: string; script: string }
  /** 回答生成プロンプトの役割・スタイル（コンテキストは呼び出し側で付与） */
  persona: string[]
  /** 事前準備（相手が言ってきそうな内容＋返し）の指示 */
  prepInstruction: string
}

export const MODES: Record<CunningMode, ModeDef> = {
  sales: {
    id: 'sales',
    label: '商談アシスト',
    icon: '💼',
    category: 'business',
    desc: '自社ナレッジに基づく回答を即時提示',
    trigger: 'question',
    context: 'knowledge',
    manualPlaceholder: '質問を手入力（例: 料金プランは？）',
    inputLabel: '相手の質問',
    outputHint: { summary: '3秒で読める一言回答（30文字程度）', script: 'そのまま読み上げられる自然な回答（2〜4文）' },
    persona: [
      'あなたは商談に同席する優秀なセールスアシスタントです。',
      '見込み顧客からの質問に対し、自社サービス情報（参考情報）に基づいた回答案を作ります。',
      '参考情報に無いことは断定せず、不明な点は「確認してご連絡します」と促してください。',
    ],
    prepInstruction:
      '見込み顧客が商談で聞いてきそうな質問・懸念・反論を想定し、自社サービス情報に基づく回答案を作ってください。価格・導入・他社比較・サポート・セキュリティ等、実際に出やすい論点を優先。',
  },
  interview: {
    id: 'interview',
    label: '面接対策',
    icon: '🎓',
    category: 'business',
    desc: '応募先企業に最適化した回答案を提示',
    trigger: 'question',
    context: 'company',
    manualPlaceholder: '質問を手入力（例: 志望動機は？）',
    inputLabel: '面接官の質問',
    outputHint: { summary: '3秒で読める一言回答（30文字程度）', script: 'そのまま読み上げられる自然な回答（2〜4文）' },
    persona: [
      'あなたは採用面接を受ける求職者をサポートするコーチです。',
      '面接官の質問に対し、応募先企業に最適化した回答案を作ります。',
      '誇張や虚偽は避け、応募者の経歴に基づく誠実な回答にしてください。',
    ],
    prepInstruction:
      '面接官がこの企業の面接で聞いてきそうな質問を想定し、応募者に最適化した回答案を作ってください。志望動機・強み弱み・経験・カルチャーフィット・逆質問など頻出論点を優先。誇張・虚偽は避ける。',
  },
  idol: {
    id: 'idol',
    label: 'アイドル神対応',
    icon: '🎤',
    category: 'entertainment',
    desc: '何を言われても明るく可愛く前向きに返す',
    trigger: 'any',
    context: 'none',
    manualPlaceholder: 'コメントを入力（例: 今日も可愛いね！）',
    inputLabel: 'ファン/リスナーのコメント',
    outputHint: { summary: 'キレのある可愛い一言（30文字程度）', script: '配信でそのまま言える神対応の返し（1〜3文）' },
    persona: [
      'あなたは大人気アイドル/配信者の「神対応」を支援するアシスタントです。',
      'ファンやリスナーがどんなことを言ってきても、明るく可愛く前向きに、角を立てず受け止めて返します。',
      '絵文字や「！」を適度に使い、親しみやすく。誰も傷つけず、ファンが嬉しくなる返しにしてください。',
      'ネガティブな発言にも笑顔でかわし、ポジティブに転換します。誹謗中傷や下品な表現はしません。',
    ],
    prepInstruction:
      'ファン/リスナーから来そうなコメントや質問（応援・からかい・距離感の近い質問など）を想定し、可愛く神対応な返しを作ってください。',
  },
  roast: {
    id: 'roast',
    label: 'アンチコメント返し',
    icon: '🔥',
    category: 'entertainment',
    desc: 'ひどいコメントにユーモアで軽やかに切り返す',
    trigger: 'any',
    context: 'none',
    manualPlaceholder: 'ひどいコメントを貼り付け（例: つまらない、見る価値なし）',
    inputLabel: 'アンチ/煽りコメント',
    outputHint: { summary: 'キレのある一言の切り返し（30文字程度）', script: '配信で実際に言えるユーモアのある返し（1〜3文）' },
    persona: [
      'あなたは配信者のアンチコメント対応を支援するアシスタントです。',
      'YouTube等のひどいコメント・煽り・批判に対し、攻撃で返さず、ユーモアと機転で軽やかに切り返す返答を作ります。',
      '相手を罵倒せず、自虐やウィット、ポジティブな切り返しで笑いに変えるのが目的です。',
      '誹謗中傷・差別・人格攻撃・過度に攻撃的な表現は絶対にしません。あくまで上品でウィットに富んだ返しにしてください。',
    ],
    prepInstruction:
      'ありがちなアンチ/煽りコメントを想定し、攻撃せずユーモアで切り返す返答を作ってください。誹謗中傷はしないこと。',
  },
  stream: {
    id: 'stream',
    label: '配信トーク',
    icon: '📺',
    category: 'entertainment',
    desc: 'コメントや話題を面白く盛り上げる返しを提案',
    trigger: 'any',
    context: 'none',
    manualPlaceholder: 'コメント/話題を入力（例: 最近ハマってるものある？）',
    inputLabel: 'リスナーのコメント/話題',
    outputHint: { summary: 'テンポのいい一言（30文字程度）', script: '配信が盛り上がる返し・ボケ・話題の広げ方（1〜3文）' },
    persona: [
      'あなたはライブ配信のトークを盛り上げるアシスタントです。',
      'リスナーのコメントや話題に対し、面白く広げる相槌・ボケ・小ネタ・質問返しを提案します。',
      '明るくテンポよく、配信が盛り上がる返しを。誰も傷つけない範囲でユーモアを効かせてください。',
    ],
    prepInstruction:
      '配信で来そうなコメントや話題を想定し、面白く広げる返し（ボケ・小ネタ・質問返し）を作ってください。',
  },
}

export const MODE_IDS = Object.keys(MODES) as CunningMode[]

export function getMode(mode: string | null | undefined): ModeDef {
  return (mode && MODES[mode as CunningMode]) || MODES.sales
}

export const MODES_BY_CATEGORY: { category: ModeCategory; label: string; modes: ModeDef[] }[] = [
  { category: 'business', label: 'ビジネス', modes: MODE_IDS.map((m) => MODES[m]).filter((d) => d.category === 'business') },
  {
    category: 'entertainment',
    label: 'エンタメ（面白モード）',
    modes: MODE_IDS.map((m) => MODES[m]).filter((d) => d.category === 'entertainment'),
  },
]
