// ============================================
// 「ドヤAIに頼む」の結果の見本（パネルの中で確かめ、保存の直前まで進める形を見せるためだけの部品）
// ============================================
// ⚠️ 見本です。ここは言葉の一致で操作を選び、操作の一覧も見本用の小さなものを持つ。
//    本物は AI（Claude Opus 5.5）が、全ツールの操作の一覧（fix/agent-router の src/lib/agent-router/catalog.ts）から選び、
//    依頼にある値を読み取る（src/app/api/agent/route/route.ts）。この見本では API・AI を呼ばない（費用が出ない）。
// ⚠️ 見本は fix/agent-router に依存しない（main に入る順番が前後しても壊れないように）。

export interface DemoField { key: string; label: string; type: 'text' | 'yen' | 'url'; required?: boolean; ask?: string }
export interface DemoAction {
  id: string
  toolId: string
  label: string
  /** 最後に利用者が押すもの */
  finalStep: string
  fields: DemoField[]
}

const URL_F = (label: string, ask: string): DemoField => ({ key: 'url', label, type: 'url', required: true, ask })

/** 見本用の操作の一覧（本物の一覧の一部。欄と最後のボタンの名前は本物と同じ） */
export const DEMO_ACTIONS: DemoAction[] = [
  { id: 'expense.contract.create', toolId: 'expense', label: '支出を登録する', finalStep: '契約を登録する',
    fields: [{ key: 'amount', label: '金額', type: 'yen', required: true, ask: '支払う金額はいくらですか？' }, { key: 'title', label: '名称', type: 'text' }] },
  { id: 'income.invoice.create', toolId: 'income', label: '請求書を作る', finalStep: '下書きを保存する',
    fields: [{ key: 'amount', label: '金額（税抜）', type: 'yen' }, { key: 'client', label: '取引先', type: 'text' }, { key: 'title', label: '件名', type: 'text' }] },
  { id: 'banner.create', toolId: 'banner', label: 'バナーを作る', finalStep: 'プロ品質バナーを生成する',
    fields: [{ key: 'keyword', label: '伝えたい言葉', type: 'text', ask: 'バナーで伝えたいことは何ですか？' }] },
  { id: 'quote.create', toolId: 'quote', label: '見積書を作る', finalStep: '見積書を作成する', fields: [{ key: 'url', label: '自社サービスのページ', type: 'url' }] },
  { id: 'doyaslide.create', toolId: 'doyaslide', label: '提案スライドを作る', finalStep: '構成を作って画像生成へ',
    fields: [{ key: 'theme', label: 'スライドのテーマ', type: 'text', required: true, ask: 'どんなテーマのスライドにしますか？' }] },
  { id: 'seo.article.create', toolId: 'seo', label: 'SEO 記事を書く', finalStep: '記事を生成する',
    fields: [{ key: 'keyword', label: '狙うキーワード', type: 'text', required: true, ask: '記事で狙う検索キーワードは何ですか？' }] },
  { id: 'persona.create', toolId: 'persona', label: 'ペルソナを作る', finalStep: 'ペルソナを生成', fields: [URL_F('サイトの URL', 'ペルソナを作るサイトの URL を教えてください')] },
  { id: 'shodan.prep.create', toolId: 'shodan', label: '商談の準備をする（1社）', finalStep: 'この企業の商談準備をつくる', fields: [URL_F('相手の会社のサイト', '商談相手の会社のサイトの URL を教えてください')] },
  { id: 'aio.scan', toolId: 'aio', label: 'AI 検索での見え方を調べる', finalStep: '調査を開始', fields: [] },
]

const PICKS: { words: string[]; id: string }[] = [
  { words: ['支出', '経費', '支払'], id: 'expense.contract.create' },
  { words: ['請求書', '請求'], id: 'income.invoice.create' },
  { words: ['バナー'], id: 'banner.create' },
  { words: ['見積'], id: 'quote.create' },
  { words: ['スライド', '提案資料'], id: 'doyaslide.create' },
  { words: ['記事', 'SEO'], id: 'seo.article.create' },
  { words: ['ペルソナ'], id: 'persona.create' },
  { words: ['商談'], id: 'shodan.prep.create' },
  { words: ['AI検索', 'AIO'], id: 'aio.scan' },
]

/** 文の中の金額（円）を読む（20万円・200,000円・3千円）。読めなければ ''。正の整数で 100億円以下だけ */
export function readYen(text: string): string {
  const s = text.normalize('NFKC').replace(/\s+/g, '')
  const m = s.match(/(\d+(?:,\d{3})*(?:\.\d+)?)(億|万|千)?円/)
  if (!m) return ''
  const unit = m[2] === '億' ? 100_000_000 : m[2] === '万' ? 10_000 : m[2] === '千' ? 1_000 : 1
  const yen = Math.round(Number(m[1].replace(/,/g, '')) * unit)
  return Number.isSafeInteger(yen) && yen > 0 && yen <= 10_000_000_000 ? String(yen) : ''
}

export interface DemoRoute {
  action: DemoAction
  /** 読み取れた値（欄の key → 値） */
  values: Record<string, string>
}

/** 見本の振り分け。合うものが無ければ null */
export function demoRoute(text: string): DemoRoute | null {
  const s = text.normalize('NFKC')
  const hit = PICKS.find((p) => p.words.some((w) => s.includes(w)))
  const action = hit ? DEMO_ACTIONS.find((a) => a.id === hit.id) : undefined
  if (!action) return null
  const values: Record<string, string> = {}
  for (const f of action.fields) {
    if (f.type === 'yen') { const y = readYen(s); if (y) values[f.key] = y }
    if (f.type === 'url') { const u = s.match(/https?:\/\/[^\s、。]+/)?.[0]; if (u) values[f.key] = u }
  }
  return { action, values }
}

/** ツールのパネルに出す「簡単な入力」: そのツールの最初の操作。見本の一覧に無いツールは null */
export function actionOfTool(toolId: string): DemoAction | null {
  return DEMO_ACTIONS.find((a) => a.toolId === toolId) ?? null
}
