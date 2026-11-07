// ============================================
// チャットで進める操作の一覧（段階1: 売上の追加 / 段階2: 請求書の下書き・支出の登録 / 段階3: 案件・休暇 / 段階4: 残業・顧客・単発の支出）
// ============================================
// ⚠️ ここに無いツールの操作は、今の案内（/api/agent/route と同じ。値を入れて画面を開く）のまま出す。
// ⚠️ 請求書の「確定」と外部への「送付」、削除は、この一覧に入れない（確認カードの対象として、設計書の操作の表で段階を決める）。
// ⚠️ 売上の追加は「単発の契約」（/income/contracts/new、type=one_time、status=active、開始日は今日）。
//    月の売上は IncomeRevenueSchedule から計算するので、手入力の請求書では月の売上に入らない。
import type { AgentAction } from '@/lib/agent-router/types'
import { durationText, parseDuration } from './duration'
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
  taxAdjust: 'divide',
}

/** 請求書の下書き（/income/invoices/new。保存すると下書きになる。確定・送付はしない）。期日は画面の今の決まり（取引先の支払条件）に任せ、AI には読ませない */
export const INCOME_INVOICE_DRAFT: ChatOp = {
  key: 'income.invoice.draft',
  toolId: 'income',
  label: '請求書の下書きを作る',
  description: '取引先への請求書を作る・下書きにする依頼（例: 株式会社サンプルに11月分の制作費30万円の請求書を作って）。保存するのは下書きまで。請求書の確定・送付はしない。契約や売上を足す依頼ではない。',
  risk: 'write',
  path: '/income/invoices/new',
  formKey: 'income.invoice.new',
  openLabels: ['ドヤ収入管理を開く', '新規請求書を開く'],
  fields: [
    { key: 'amount', label: '金額（税抜）', type: 'yen', required: true, hint: '請求する金額（円）。依頼の文に書かれているときだけ', ask: '請求する金額（税抜）はいくらですか？' },
    { key: 'client', label: '取引先', type: 'text', required: true, hint: '請求の相手の会社名。依頼の文に書かれているときだけ', ask: '請求先の取引先はどちらですか？' },
    { key: 'title', label: '件名', type: 'text', required: true, hint: '何の請求か（例: 11月分 制作費）。依頼の文に書かれているときだけ', ask: '何の請求ですか？ 件名と明細の品目に入れます。' },
  ],
  pickKeys: ['client'],
  fixed: [],
  fillLabels: { amount: '金額を入れる', client: '取引先を入れる', title: '件名を入れる' },
  confirmTitle: 'この内容で下書きを保存しますか？',
  submitLabel: '下書きを保存する',
  confirmStepLabel: '確認して下書きを保存する',
  taxAdjust: 'divide',
  replaces: 'income.invoice.create',
}

/** 支出の登録（ドヤ支出管理の新規契約。組織の画面は入口の ?to=new-contract が運ぶ）。カテゴリ・周期・開始日は画面の既定のまま入れ、確認カードに出す */
export const EXPENSE_ADD: ChatOp = {
  key: 'expense.contract.add',
  toolId: 'expense',
  label: '支出を登録する',
  description: '固定費・SaaS・外注費・家賃などの支払い（支出の契約）を登録する依頼（例: Notion ビジネスプラン月5,000円で登録して）。毎月の支払予定が作られる。売上や請求書の依頼ではない。',
  risk: 'write',
  path: '/expense?to=new-contract',
  here: '^/expense/[^/]+/contracts/new$',
  formKey: 'expense.contract.new',
  openLabels: ['ドヤ支出管理を開く', '支出契約の追加を開く'],
  fields: [
    { key: 'amount', label: '金額', type: 'yen', required: true, hint: '1回の支払いの金額（円）。依頼の文に書かれているときだけ', ask: '1回の支払いの金額はいくらですか？' },
    { key: 'vendor', label: '取引先', type: 'text', required: true, hint: '支払う相手（会社名・サービス名）。依頼の文に書かれているときだけ', ask: '支払う相手の取引先はどちらですか？' },
    { key: 'title', label: '名称', type: 'text', required: true, hint: '何の支払いか（例: Notion ビジネスプラン、デザイン外注）。依頼の文に書かれているときだけ', ask: '何の支払いですか？ 名称に入れます。' },
  ],
  pickKeys: ['vendor'],
  fixed: [],
  fillLabels: { amount: '金額を入れる', vendor: '取引先を入れる', title: '名称を入れる' },
  confirmTitle: 'この内容で登録しますか？',
  submitLabel: '登録する',
  taxAdjust: 'flag',
  replaces: 'expense.contract.create',
}

/** 案件の作成（ドヤプロマネ。入口 /promane?to=new-project が、1つだけのワークスペースの新規案件の画面へ運ぶ）。ステータス・請求タイプなどは画面の初期値のまま入れ、確認カードに出す */
export const PROMANE_PROJECT_ADD: ChatOp = {
  key: 'promane.project.add',
  toolId: 'promane',
  label: '案件を作る',
  description: '案件（プロジェクト）を新しく作る依頼（例: 株式会社サンプルの Webサイト制作 契約金額200万円で案件を作って）。案件名と契約金額を読む。タスク・工数・経費を足す依頼ではない。',
  risk: 'write',
  path: '/promane?to=new-project',
  here: '^/promane/[^/]+/projects/new$',
  formKey: 'promane.project.new',
  openLabels: ['ドヤプロマネを開く', '新規案件の画面を開く'],
  fields: [
    { key: 'name', label: '案件名', type: 'text', required: true, hint: '案件の名前（例: Webサイト制作）。依頼の文に書かれているときだけ', ask: '案件の名前は何ですか？' },
    { key: 'amount', label: '契約金額', type: 'yen', required: true, hint: '契約金額（円）。依頼の文に書かれているときだけ', ask: '契約金額（円）はいくらですか？' },
  ],
  pickKeys: [],
  fixed: [],
  fillLabels: { name: '案件名を入れる', amount: '契約金額を入れる' },
  confirmTitle: 'この内容で案件を作りますか？',
  submitLabel: '案件を作る',
  taxAdjust: 'none',
}

/** 休暇の申請（ドヤ勤怠 /kintai/requests/new。申請の提出まで。承認は管理者が行い、ここでは承認しない）。休暇の種類は有給休暇に決め、特別休暇・欠勤は画面で選んでもらう */
export const KINTAI_LEAVE_REQUEST: ChatOp = {
  key: 'kintai.request.leave',
  toolId: 'kintai',
  label: '休暇を申請する',
  description: '有給休暇を申請する依頼（例: 来週月曜から2日間、私用のため有給休暇を申請して）。開始日・終了日・理由を読む。承認はしない。残業・休日出勤・打刻修正の申請ではない。',
  risk: 'write',
  path: '/kintai/requests/new',
  here: '^/kintai/requests/new$',
  formKey: 'kintai.request.new',
  openLabels: ['ドヤ勤怠を開く', '新規申請の画面を開く'],
  fields: [
    { key: 'start', label: '開始日', type: 'date', required: true, hint: '休暇の最初の日（YYYY-MM-DD）。今日の日付から計算してよいが、依頼の文に日付の言葉があるときだけ', ask: '休暇の開始日はいつですか？' },
    { key: 'end', label: '終了日', type: 'date', required: true, hint: '休暇の最後の日（YYYY-MM-DD）。1日だけなら開始日と同じ', ask: '休暇の終了日はいつですか？ 1日だけなら開始日と同じ日を入れてください。' },
    { key: 'reason', label: '理由', type: 'text', required: true, hint: '休暇の理由（例: 私用のため）。依頼の文に書かれているときだけ', ask: '休暇の理由は何ですか？' },
  ],
  pickKeys: ['start', 'end'],
  fixed: [
    { key: 'type', value: 'leave', label: '申請の種類を「休暇」にする' },
    { key: 'leaveType', value: 'paid', label: '休暇の種類を「有給休暇」にする' },
  ],
  fillLabels: { start: '開始日を入れる', end: '終了日を入れる', reason: '理由を入れる' },
  confirmTitle: 'この内容で申請しますか？',
  submitLabel: '申請する',
  confirmStepLabel: '確認して申請する',
  taxAdjust: 'none',
}

/** 残業の申請（ドヤ勤怠 /kintai/requests/new。申請の提出まで。承認は管理者が行い、ここでは承認しない）。時間は「2時間30分」の言い方で読み、画面の「時間」「分」に分けて入れる */
export const KINTAI_OVERTIME_REQUEST: ChatOp = {
  key: 'kintai.request.overtime',
  toolId: 'kintai',
  label: '残業を申請する',
  description: '残業の申請を出す依頼（例: 昨日2時間30分残業したので申請して）。対象日・残業の時間・理由を読む。承認はしない。休暇・休日出勤・打刻修正の申請ではない。',
  risk: 'write',
  path: '/kintai/requests/new',
  here: '^/kintai/requests/new$',
  formKey: 'kintai.request.new',
  openLabels: ['ドヤ勤怠を開く', '新規申請の画面を開く'],
  fields: [
    { key: 'date', label: '対象日', type: 'date', required: true, hint: '残業した日（YYYY-MM-DD）。今日の日付から計算してよいが、依頼の文に日付の言葉があるときだけ', ask: '残業した日はいつですか？ 例: 2026-11-05' },
    { key: 'duration', label: '残業の時間', type: 'text', required: true, hint: '残業した時間。依頼の文に書かれた言い方のまま（例: 2時間30分、45分、1時間）。依頼の文に無いときは入れない', ask: '残業は何時間何分ですか？ 例: 1時間30分、45分' },
    { key: 'reason', label: '理由', type: 'text', required: true, hint: '残業の理由（例: 納期対応のため）。依頼の文に書かれているときだけ', ask: '残業の理由は何ですか？' },
  ],
  // 時間は「時間」「分」の2欄に分けて入れるので、1字ずつ入れる動きにしない（途中の「2時間3」を欄に入れない）
  pickKeys: ['date', 'duration'],
  fixed: [
    { key: 'type', value: 'overtime', label: '申請の種類を「残業」にする' },
  ],
  fillLabels: { date: '対象日を入れる', duration: '残業の時間を入れる', reason: '理由を入れる' },
  confirmTitle: 'この内容で申請しますか？',
  submitLabel: '申請する',
  confirmStepLabel: '確認して申請する',
  taxAdjust: 'none',
}

/** 顧客の追加（ドヤプロマネ /promane/[slug]/clients の「顧客を追加」）。会社名が必須で、担当者名・メール・電話は依頼の文に書かれているときだけ入れる。住所とメモは入れない */
export const PROMANE_CLIENT_ADD: ChatOp = {
  key: 'promane.client.add',
  toolId: 'promane',
  label: '顧客を追加する',
  description: '顧客（取引先の会社）を新しく登録する依頼（例: 株式会社サンプルを顧客に追加して）。会社名を読み、担当者名・メール・電話は書かれているときだけ読む。案件や経費を足す依頼ではない。',
  risk: 'write',
  path: '/promane?to=new-client',
  here: '^/promane/[^/]+/clients$',
  formKey: 'promane.client.new',
  openLabels: ['ドヤプロマネを開く', '顧客の追加を開く'],
  fields: [
    { key: 'name', label: '会社名', type: 'text', required: true, hint: '顧客の会社名。依頼の文に書かれているときだけ', ask: '顧客の会社名は何ですか？' },
    { key: 'contactName', label: '担当者名', type: 'text', hint: '先方の担当者の名前。依頼の文に書かれているときだけ' },
    { key: 'email', label: 'メール', type: 'email', hint: '先方のメールアドレス。依頼の文に書かれているときだけ' },
    { key: 'phone', label: '電話', type: 'text', hint: '先方の電話番号。依頼の文に書かれているときだけ' },
  ],
  pickKeys: [],
  fixed: [],
  fillLabels: { name: '会社名を入れる', contactName: '担当者名を入れる', email: 'メールを入れる', phone: '電話を入れる' },
  confirmTitle: 'この内容で顧客を追加しますか？',
  submitLabel: '顧客を追加する',
  taxAdjust: 'none',
}

/** 単発の支出の追加（ドヤ支出管理 /expense/[org]/payables の「単発の支出を追加」）。カテゴリ・税率・源泉は画面の初期値のまま入れ、確認カードに出す。支払日は依頼に日付の言葉があるときだけ読む */
export const EXPENSE_ONEOFF_ADD: ChatOp = {
  key: 'expense.schedule.add',
  toolId: 'expense',
  label: '単発の支出を追加する',
  description: '1回きりの支払い（会議室の利用料、備品の購入、立替など）を、支払予定に1件追加する依頼（例: 会議室の利用料 8,000円を単発の支出に追加して）。毎月の支払いの契約を登録する依頼ではない。',
  risk: 'write',
  path: '/expense?to=new-payable',
  here: '^/expense/[^/]+/payables$',
  formKey: 'expense.schedule.new',
  openLabels: ['ドヤ支出管理を開く', '単発の支出の追加を開く'],
  fields: [
    { key: 'amount', label: '金額', type: 'yen', required: true, hint: '1回の支払いの金額（円）。依頼の文に書かれているときだけ', ask: '支払う金額はいくらですか？' },
    { key: 'title', label: '内容', type: 'text', required: true, hint: '何の支払いか（例: 会議室の利用料）。依頼の文に書かれているときだけ', ask: '何の支払いですか？ 内容に入れます。' },
    { key: 'payDate', label: '支払日', type: 'date', hint: '支払う日（YYYY-MM-DD）。依頼の文に日付の言葉があるときだけ。無ければ入れない（画面の初期値を使う）' },
  ],
  pickKeys: ['payDate'],
  fixed: [],
  fillLabels: { amount: '金額を入れる', title: '内容を入れる', payDate: '支払日を入れる' },
  confirmTitle: 'この内容で追加しますか？',
  submitLabel: '追加する',
  taxAdjust: 'flag',
}

export const CHAT_OPS: ChatOp[] = [INCOME_SALE_ADD, INCOME_INVOICE_DRAFT, EXPENSE_ADD, PROMANE_PROJECT_ADD, KINTAI_LEAVE_REQUEST, KINTAI_OVERTIME_REQUEST, PROMANE_CLIENT_ADD, EXPENSE_ONEOFF_ADD]

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

/**
 * 作業の一覧（会話に1行ずつ出す）。ツールを開く → 画面を開く → 決まった値 → 欄 → 確認して登録する。
 * values を渡すと、必須でなく値も無い欄（書かれていない任意の項目）は一覧に出さない（入れていない欄を、済みと見せない）。
 */
export function buildSteps(op: ChatOp, values?: Record<string, string>): StepView[] {
  const rows: { id: string; label: string }[] = [
    { id: 'open-tool', label: op.openLabels[0] },
    { id: 'open-form', label: op.openLabels[1] },
    ...op.fixed.map((f) => ({ id: `fixed:${f.key}`, label: f.label })),
    ...op.fields.filter((f) => !values || f.required || Boolean(values[f.key])).map((f) => ({ id: `fill:${f.key}`, label: op.fillLabels[f.key] ?? `${f.label}を入れる` })),
    { id: 'confirm', label: op.confirmStepLabel ?? '確認して登録する' },
  ]
  return rows.map((r) => ({ ...r, status: 'wait' as const }))
}

/** 依頼を受けたときの最初のひと言（依頼の文で確かめた値だけを使う） */
export function leadText(op: ChatOp, values: Record<string, string>): string {
  if (op.key === 'income.sale.add') return values.amount ? `${yenText(values.amount)} の売上を追加します。` : '売上を追加します。'
  if (op.key === 'income.invoice.draft') return values.amount ? `${yenText(values.amount)} の請求書の下書きを作ります。` : '請求書の下書きを作ります。'
  if (op.key === 'expense.contract.add') return values.amount ? `${yenText(values.amount)} の支出を登録します。` : '支出を登録します。'
  if (op.key === 'promane.project.add') return values.name ? `「${values.name}」の案件を作ります。` : '案件を作ります。'
  if (op.key === 'kintai.request.leave') return values.start ? `${jaDate(values.start)}${values.end && values.end !== values.start ? `から${jaDate(values.end)}` : ''}の有給休暇を申請します。` : '有給休暇を申請します。'
  if (op.key === 'kintai.request.overtime') {
    const d = values.duration ? parseDuration(values.duration) : null
    return values.date && d ? `${jaDate(values.date)}の残業（${durationText(d.hours, d.minutes)}）を申請します。` : '残業を申請します。'
  }
  if (op.key === 'promane.client.add') return values.name ? `「${values.name}」を顧客に追加します。` : '顧客を追加します。'
  if (op.key === 'expense.schedule.add') return values.amount ? `${yenText(values.amount)} の単発の支出を追加します。` : '単発の支出を追加します。'
  return `${op.label}。`
}

/**
 * 聞き返しへの答えの形を確かめる（問題があれば、本人に返す案内。無ければ null）。
 * 欄の型（normalizeValue）だけでは確かめられない形（残業の時間の言い方）をここで見る。
 */
export function answerProblem(op: ChatOp, key: string, value: string): string | null {
  if (op.key === 'kintai.request.overtime' && key === 'duration' && !parseDuration(value)) {
    return '残業の時間の形が合いません。「1時間30分」「45分」のように入れてください（24時間まで）。'
  }
  return null
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
  if (op.key === 'income.invoice.draft') {
    const sub = snap.subtotal ? yenText(snap.subtotal) : '入れた金額'
    return {
      rows: [
        { label: '取引先', value: snap.client || '未入力' },
        { label: '件名', value: snap.title || '未入力' },
        { label: '請求日', value: snap.issue || '—' },
        { label: '支払期日', value: snap.due || '取引先の支払条件で決まります' },
        { label: '金額（税抜）', value: snap.subtotal ? yenText(snap.subtotal) : '—', big: true },
        { label: '消費税', value: snap.tax ? yenText(snap.tax) : '—' },
        { label: '合計', value: snap.total ? yenText(snap.total) : '—' },
      ],
      note: `${sub} を税抜として入れました。税込みの金額なら直します。保存するのは下書きまでで、確定と送付はまだ行いません。`,
    }
  }
  if (op.key === 'expense.contract.add') {
    const incl = snap.taxIncluded === 'true'
    const amount = snap.amount ? yenText(snap.amount) : '—'
    return {
      rows: [
        { label: '取引先', value: snap.vendor || '未入力' },
        { label: '名称', value: snap.title || '未入力' },
        { label: 'カテゴリ', value: snap.category || '—' },
        { label: '支払の周期', value: snap.cycle || '—' },
        { label: '開始日', value: snap.start || '—' },
        { label: incl ? '金額（税込）' : '金額（税抜）', value: amount, big: true },
      ],
      note: `${amount} を${incl ? '税込' : '税抜'}として入れました。${incl ? '税抜なら' : '税込みなら'}直します。カテゴリと周期は画面の初期値です。違うときは、画面で直してからもう一度確認してください。登録すると、12か月先までの支払予定が作られます。`,
    }
  }
  if (op.key === 'promane.project.add') {
    const rows: ConfirmRow[] = [
      { label: '案件名', value: snap.name || '未入力' },
      { label: '顧客', value: snap.client || 'なし' },
      { label: 'ステータス', value: snap.status || '—' },
      { label: '請求タイプ', value: snap.billing || '—' },
      { label: '契約金額', value: snap.amount ? yenText(snap.amount) : '—', big: true },
    ]
    if (snap.start) rows.push({ label: '開始日', value: snap.start })
    if (snap.end) rows.push({ label: '納期', value: snap.end })
    return { rows, note: 'ステータスと請求タイプは画面の初期値です。顧客・開始日・納期は入れていません。違うときは、画面で直してからもう一度確認してください。作るのは案件だけで、タスクや請求は作りません。' }
  }
  if (op.key === 'kintai.request.leave') {
    const days = dayCount(snap.start, snap.end)
    return {
      rows: [
        { label: '申請の種類', value: snap.typeLabel || '休暇' },
        { label: '休暇の種類', value: snap.leaveLabel || '—' },
        { label: '期間', value: snap.start && snap.end ? `${jaDate(snap.start)}から${jaDate(snap.end)}${days ? `（${days}日間）` : ''}` : '—', big: true },
        { label: '理由', value: snap.reason || '未入力' },
      ],
      note: '申請を出すだけで、承認はされません。承認は管理者が行います。特別休暇・欠勤のときは、画面で種類を選び直してください。',
    }
  }
  if (op.key === 'kintai.request.overtime') {
    const dur = durationText(snap.hours, snap.minutes)
    return {
      rows: [
        { label: '申請の種類', value: snap.typeLabel || '残業' },
        { label: '対象日', value: snap.date ? jaDate(snap.date) : '未入力' },
        { label: '残業の時間', value: dur || '未入力', big: true },
        { label: '理由', value: snap.reason || '未入力' },
      ],
      note: '申請を出すだけで、承認はされません。承認は管理者が行います。',
    }
  }
  if (op.key === 'promane.client.add') {
    return {
      rows: [
        { label: '会社名', value: snap.name || '未入力', big: true },
        { label: '担当者名', value: snap.contactName || '入れていません' },
        { label: 'メール', value: snap.email || '入れていません' },
        { label: '電話', value: snap.phone || '入れていません' },
      ],
      note: '担当者名・メール・電話は、依頼に書かれたものだけを入れました。住所とメモは入れていません。追加するのは顧客だけで、案件には紐づけません。',
    }
  }
  if (op.key === 'expense.schedule.add') {
    const incl = snap.taxIncluded === 'true'
    const amount = snap.amount ? yenText(snap.amount) : '—'
    return {
      rows: [
        { label: '内容', value: snap.title || '未入力' },
        { label: 'カテゴリ', value: snap.category || '—' },
        { label: '支払日', value: snap.payDate ? jaDate(snap.payDate) : '—' },
        { label: '税率', value: snap.taxRate || '—' },
        { label: '源泉徴収', value: snap.withholding === 'true' ? '対象にする' : '対象にしない' },
        { label: incl ? '金額（税込）' : '金額（税抜）', value: amount, big: true },
      ],
      note: `${amount} を${incl ? '税込' : '税抜'}として入れました。${incl ? '税抜なら' : '税込みなら'}直します。カテゴリ・税率・源泉徴収は画面の初期値です。支払日は、依頼に日付の言葉があるときだけ入れ、無いときは画面の初期値のままです。違うときは、画面で直してからもう一度確認してください。`,
    }
  }
  return { rows: [], note: '' }
}

/** 2026-11-10 → 2026年11月10日（形が違うときはそのまま） */
function jaDate(ymd: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : (ymd ?? '')
}

/** 2つの日付（YYYY-MM-DD）の間の日数（両端を含む）。形が違うときや逆のときは 0 */
function dayCount(a: string | undefined, b: string | undefined): number {
  if (!a || !b || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 0
  const n = (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 + 1
  return Number.isFinite(n) && n >= 1 ? n : 0
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
  if (op.key === 'income.invoice.draft') {
    return {
      lead: `請求書の下書きを保存しました。${snap.subtotal ? `${yenText(snap.subtotal)}（税抜）、` : ''}${snap.client ? `${snap.client}あてです。` : ''}確定と送付はまだ行っていません。`,
      made: '請求書の下書き 1件',
      next: [
        { id: 'open-draft', label: '下書きを開いて内容を確かめる', hint: '次のおすすめ', href },
        { id: 'invoice-list', label: '請求書の一覧を見る', hint: '確認', href: '/income/invoices' },
      ],
    }
  }
  if (op.key === 'expense.contract.add') {
    const base = href.replace(/\/contracts\/[^/]+$/, '')
    return {
      lead: `「${snap.title || '支出'}」の支出を登録しました。${snap.amount ? `${yenText(snap.amount)}（${snap.taxIncluded === 'true' ? '税込' : '税抜'}）の` : ''}支払予定は、12か月先まで作られます。`,
      made: '支出の契約 1件（支払予定つき）',
      next: [
        { id: 'open-made', label: '登録した契約を見る', hint: '次のおすすめ', href },
        { id: 'forecast', label: '資金繰りの見通しを見る', hint: '確認', href: `${base}/forecast` },
      ],
    }
  }
  if (op.key === 'promane.project.add') {
    const base = href.replace(/\/projects\/[^/]+$/, '')
    return {
      lead: `「${snap.name || '案件'}」の案件を作りました。${snap.amount ? `契約金額は ${yenText(snap.amount)} です。` : ''}タスクや請求は、まだ作っていません。`,
      made: '案件 1件',
      next: [
        { id: 'open-made', label: '作った案件を開く', hint: '次のおすすめ', href },
        { id: 'project-list', label: '案件の一覧を見る', hint: '確認', href: `${base}/projects` },
      ],
    }
  }
  if (op.key === 'kintai.request.leave') {
    return {
      lead: `有給休暇を申請しました。${snap.start && snap.end ? `${jaDate(snap.start)}から${jaDate(snap.end)}までの分です。` : ''}承認は、管理者が行います。`,
      made: '休暇の申請 1件（承認待ち）',
      next: [
        { id: 'open-requests', label: '申請の一覧を見る', hint: '次のおすすめ', href },
      ],
    }
  }
  if (op.key === 'kintai.request.overtime') {
    const dur = durationText(snap.hours, snap.minutes)
    return {
      lead: `残業を申請しました。${snap.date ? `${jaDate(snap.date)}の分${dur ? `（${dur}）` : ''}です。` : ''}承認は、管理者が行います。`,
      made: '残業の申請 1件（承認待ち）',
      next: [
        { id: 'open-requests', label: '申請の一覧を見る', hint: '次のおすすめ', href },
      ],
    }
  }
  if (op.key === 'promane.client.add') {
    const base = href.replace(/\/clients$/, '')
    return {
      lead: `「${snap.name || '顧客'}」を顧客に追加しました。案件には、まだ紐づけていません。`,
      made: '顧客 1件',
      next: [
        { id: 'open-clients', label: '顧客の一覧を見る', hint: '次のおすすめ', href },
        { id: 'project-new', label: '案件を作る', hint: '任意', href: `${base}/projects/new` },
      ],
    }
  }
  if (op.key === 'expense.schedule.add') {
    const base = href.replace(/\/payables.*$/, '')
    return {
      lead: `「${snap.title || '単発の支出'}」を支払予定に追加しました。${snap.amount ? `${yenText(snap.amount)}（${snap.taxIncluded === 'true' ? '税込' : '税抜'}）、` : ''}${snap.payDate ? `支払日は${jaDate(snap.payDate)}です。` : ''}支払いの記録（支払済み）には、まだしていません。`,
      made: '単発の支出 1件（支払予定）',
      next: [
        { id: 'open-made', label: '支払予定の一覧を見る', hint: '次のおすすめ', href },
        { id: 'forecast', label: '資金繰りの見通しを見る', hint: '確認', href: `${base}/forecast` },
      ],
    }
  }
  return { lead: '登録しました。', made: '', next: [] }
}
