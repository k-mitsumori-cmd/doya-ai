// ============================================
// チャットで進める操作の一覧（段階1は「売上を追加する」だけ）
// ============================================
// ⚠️ ほかのツールの操作は、今の案内（/api/agent/route と同じ。値を入れて画面を開く）のまま出す。
// ⚠️ 売上の追加は「単発の契約」（/income/contracts/new、type=one_time、status=active、開始日は今日）。
//    月の売上は IncomeRevenueSchedule から計算するので、手入力の請求書では月の売上に入らない。
import type { AgentAction } from '@/lib/agent-router/types'
import { monthLabelOf, yenText } from './today'
import type { AgentFormSnapshot, ChatFixed, ChatOp, ConfirmRow, NextAction, StepView } from './types'

export const INCOME_SALE_ADD: ChatOp = {
  key: 'income.sale.add',
  toolId: 'income',
  label: '売上を追加する',
  description: '売上を足す・追加する・記録する依頼（例: 今月の売上100万円追加して）。単発の売上を、契約として1件登録する。請求書を作る依頼ではない。',
  risk: 'write',
  path: '/income/contracts/new',
  formKey: 'income.contract.new',
  openLabels: ['ドヤ収入管理を開く', '新規契約を開く'],
  fields: [
    { key: 'amount', label: '金額（税抜）', type: 'yen', required: true, hint: '売上の金額（円）。依頼の文に書かれているときだけ', ask: '金額（税抜）はいくらですか？' },
    { key: 'client', label: '取引先', type: 'text', required: true, hint: '売上の相手の会社名。依頼の文に書かれているときだけ', ask: '取引先はどちらですか？' },
    { key: 'title', label: '契約名', type: 'text', required: true, hint: '何の売上か（例: Web 制作費）。依頼の文に書かれているときだけ', ask: '何の売上ですか？ 契約名に入れます。' },
  ],
  pickKeys: ['client'],
  fixed: [
    { key: 'type', value: 'one_time', label: '種類を「単発」にする' },
    { key: 'status', value: 'active', label: '状態を「有効」にする' },
    { key: 'start', value: '@today', label: '開始日を今日にする' },
  ],
  fillLabels: { amount: '金額を入れる', client: '取引先を入れる', title: '契約名を入れる' },
  confirmTitle: 'この内容で登録しますか？',
  submitLabel: '登録する',
}

export const CHAT_OPS: ChatOp[] = [INCOME_SALE_ADD]

export function chatOpByKey(key: string | null | undefined): ChatOp | undefined {
  return CHAT_OPS.find((o) => o.key === key)
}

/** 操作を、今の案内（AgentAction）と同じ形にする（AI に渡す一覧に混ぜるため） */
export function opAsAction(op: ChatOp): AgentAction {
  return { id: op.key, toolId: op.toolId, label: op.label, description: op.description, path: op.path, finalStep: '確認カードの「' + op.submitLabel + '」', fields: op.fields }
}

/** 決まった値を、今日の日付で確定する */
export function resolveFixed(op: ChatOp, today: string): { key: string; value: string; label: string }[] {
  return op.fixed.map((f: ChatFixed) => ({ ...f, value: f.value === '@today' ? today : f.value }))
}

/** 作業の一覧（会話に1行ずつ出す）。ツールを開く → 画面を開く → 決まった値 → 欄 → 確認して登録する */
export function buildSteps(op: ChatOp): StepView[] {
  const rows: { id: string; label: string }[] = [
    { id: 'open-tool', label: op.openLabels[0] },
    { id: 'open-form', label: op.openLabels[1] },
    ...op.fixed.map((f) => ({ id: `fixed:${f.key}`, label: f.label })),
    ...op.fields.map((f) => ({ id: `fill:${f.key}`, label: op.fillLabels[f.key] ?? `${f.label}を入れる` })),
    { id: 'confirm', label: '確認して登録する' },
  ]
  return rows.map((r) => ({ ...r, status: 'wait' as const }))
}

/** 依頼を受けたときの最初のひと言（依頼の文で確かめた値だけを使う） */
export function leadText(op: ChatOp, values: Record<string, string>): string {
  if (op.key === 'income.sale.add') return values.amount ? `${yenText(values.amount)} の売上を追加します。` : '売上を追加します。'
  return `${op.label}。`
}

/** 確認カードの行。数字は画面の値（税の計算も画面の今の処理）をそのまま読む */
export function confirmRows(op: ChatOp, snap: AgentFormSnapshot): { rows: ConfirmRow[]; note: string } {
  if (op.key === 'income.sale.add') {
    const month = monthLabelOf(snap.start) || '—'
    return {
      rows: [
        { label: '取引先', value: snap.client || '未入力' },
        { label: '契約名', value: snap.title || '未入力' },
        { label: '計上月', value: month },
        { label: '金額（税抜）', value: snap.subtotal ? yenText(snap.subtotal) : '—', big: true },
        { label: '消費税', value: snap.tax ? yenText(snap.tax) : '—' },
        { label: '合計', value: snap.total ? yenText(snap.total) : '—' },
      ],
      note: `${snap.subtotal ? yenText(snap.subtotal) : '入れた金額'} を税抜として入れました。税込みの金額なら直します。`,
    }
  }
  return { rows: [], note: '' }
}

/** 完了の表示（画面の送信が成功を知らせたあとだけ使う） */
export function doneView(op: ChatOp, snap: AgentFormSnapshot, href: string): { lead: string; made: string; next: NextAction[] } {
  if (op.key === 'income.sale.add') {
    const month = monthLabelOf(snap.start)
    return {
      lead: `${month ? `${month}の売上予定` : '売上予定'}に ${snap.subtotal ? yenText(snap.subtotal) : '売上'}（税抜）を追加しました。請求書はまだ作っていません。`,
      made: '契約 1件（売上予定つき）',
      next: [
        {
          id: 'invoice-draft', label: '請求書の下書きを作る', hint: '次のおすすめ', href: '/income/invoices/new',
          prefill: { ...(snap.subtotal ? { amount: snap.subtotal } : {}), ...(snap.client ? { client: snap.client } : {}), ...(snap.title ? { title: snap.title } : {}) },
        },
        { id: 'client-detail', label: '取引先の住所と支払条件を足す', hint: '任意', href: '/income/clients' },
        { id: 'open-made', label: '登録した契約を見る', hint: '確認', href },
      ],
    }
  }
  return { lead: '登録しました。', made: '', next: [] }
}
