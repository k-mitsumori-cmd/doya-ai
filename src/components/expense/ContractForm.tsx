'use client'

// 契約の登録・編集フォーム、単価の入力欄
import { useEffect, useState } from 'react'
import { useDoyaPrefill } from '@/components/agent-router/useDoyaPrefill'
import toast from 'react-hot-toast'
import {
  BILLING_MODELS, BILLING_MODEL_LABEL, CATEGORIES, CATEGORY_LABEL, CONTRACT_STATUSES, CONTRACT_STATUS_LABEL, CURRENCIES,
  FORECAST_MODE_LABEL, FREQUENCIES, FREQUENCY_LABEL, PAYMENT_METHOD_LABEL, type BillingModel, type ForecastMode,
} from '@/lib/expense/constants'
import { expenseApi, jsonInit, useExpenseQuery } from './api'
import type { Contract, PaymentMethod, Vendor } from './types'
import VendorFields, { draftToPayload, emptyVendor, type VendorDraft } from './VendorForm'
import { Btn, Card, Check, Field, inputCls, todayYmd, useExpenseOrg } from './ui'

// ---------- 単価 ----------
export interface PriceDraft { effectiveFrom: string; unitPrice: string; quantity: string; capQuantity: string; taxRate: string; taxIncluded: boolean }
export const emptyPrice = (effectiveFrom = todayYmd()): PriceDraft => ({ effectiveFrom, unitPrice: '', quantity: '1', capQuantity: '', taxRate: '10', taxIncluded: false })

/** USD は画面ではドル、API にはセントで送る */
export function priceToPayload(d: PriceDraft, currency: string) {
  const unit = Number(d.unitPrice)
  return {
    effectiveFrom: d.effectiveFrom,
    unitPrice: currency === 'USD' ? Math.round(unit * 100) : unit,
    quantity: d.quantity === '' ? 1 : Number(d.quantity),
    capQuantity: d.capQuantity === '' ? null : Number(d.capQuantity),
    taxRate: Number(d.taxRate),
    taxIncluded: d.taxIncluded,
  }
}

const PRICE_LABEL: Record<string, { unit: string; qty?: string; cap?: string }> = {
  fixed: { unit: '金額（1回の支払あたり）' },
  per_seat: { unit: '1席あたりの単価', qty: '席数' },
  hourly: { unit: '時給', qty: '予定の稼働時間', cap: '上限時間' },
  per_deliverable: { unit: '1本あたりの単価', qty: '予定本数' },
  variable: { unit: '単価', qty: '予定の数量' },
}

export function PriceFields({ value, onChange, billingModel, currency, withDate }: { value: PriceDraft; onChange: (v: PriceDraft) => void; billingModel: string; currency: string; withDate?: boolean }) {
  const L = PRICE_LABEL[billingModel] ?? PRICE_LABEL.fixed
  const set = <K extends keyof PriceDraft>(k: K, v: PriceDraft[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {withDate && <Field label="適用開始日"><input type="date" className={inputCls} value={value.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} /></Field>}
      <Field label={`${L.unit}（${currency === 'USD' ? 'ドル' : '円'}）`}><input type="number" min={0} step={currency === 'USD' ? '0.01' : '1'} className={inputCls} value={value.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} /></Field>
      {L.qty && <Field label={L.qty}><input type="number" min={0} className={inputCls} value={value.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>}
      {L.cap && <Field label={L.cap}><input type="number" min={0} className={inputCls} value={value.capQuantity} onChange={(e) => set('capQuantity', e.target.value)} /></Field>}
      <Field label="税率">
        <select className={inputCls} value={value.taxRate} onChange={(e) => set('taxRate', e.target.value)}>
          <option value="10">10%</option><option value="8">8%</option><option value="0">非課税・不課税</option>
        </select>
      </Field>
      <div className="flex items-end pb-2"><Check checked={value.taxIncluded} onChange={(v) => set('taxIncluded', v)} label="入力した金額は税込です" /></div>
    </div>
  )
}

// ---------- 契約 ----------
const CONTRACTOR_FORMS = [
  { key: 'fixed', label: '月額固定', desc: '毎月同じ金額を払います。例: 月30万円', billingModel: 'fixed', freq: 1 },
  { key: 'hourly', label: '時給×稼働', desc: '時給と稼働時間で金額が決まります。上限時間を決めると、上限までの金額で予定額を計算できます。', billingModel: 'hourly', freq: 1 },
  { key: 'per_deliverable', label: '成果物ごと', desc: '1本あたりの単価に、予定本数をかけた金額です。例: 記事1本3万円', billingModel: 'per_deliverable', freq: 1 },
  { key: 'half', label: '半年まとめ', desc: '半年に一度、まとめて払います。支払月にだけ予定が作られます。', billingModel: 'fixed', freq: 6 },
] as const

const contractorKey = (billingModel: string, freq: number) => (billingModel === 'fixed' && freq === 6 ? 'half' : CONTRACTOR_FORMS.find((x) => x.billingModel === billingModel && x.freq === freq)?.key ?? 'fixed')

export default function ContractForm({ mode, initial, preset, onSaved }: { mode: 'create' | 'edit'; initial?: Contract; preset?: 'contractor'; onSaved: (id: string) => void }) {
  const { orgSlug, canManage } = useExpenseOrg()
  const vendors = useExpenseQuery<{ vendors: Vendor[] }>(mode === 'create' ? '/api/expense/vendors' : null, orgSlug)
  const methods = useExpenseQuery<{ paymentMethods: PaymentMethod[] }>('/api/expense/payment-methods', orgSlug)
  const contractor0 = preset === 'contractor'

  const [f, setF] = useState({
    title: initial?.title ?? '',
    category: initial?.category ?? (contractor0 ? 'contractor' : 'saas'),
    billingModel: initial?.billingModel ?? 'fixed',
    frequencyMonths: String(initial?.frequencyMonths ?? 1),
    startDate: initial?.startDate ?? todayYmd(),
    anchorDate: '',
    endDate: initial?.endDate ?? '',
    autoRenew: initial?.autoRenew ?? false,
    renewalNoticeDays: String(initial?.renewalNoticeDays ?? 30),
    currency: initial?.currency ?? 'JPY',
    withholding: initial?.withholding ?? contractor0,
    forecastMode: initial?.forecastMode ?? 'planned',
    paymentMethodId: initial?.paymentMethod?.id ?? '',
    status: initial?.status ?? 'active',
    note: initial?.note ?? '',
  })
  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>(contractor0 ? 'new' : 'existing')
  const [vendorId, setVendorId] = useState('')
  // 取引先が1件もないときは、最初から「新しく登録する」を開いて、契約から始められるようにする
  const [autoOpened, setAutoOpened] = useState(false)
  useEffect(() => {
    if (mode === 'create' && !autoOpened && vendors.data && vendors.data.vendors.length === 0) {
      setAutoOpened(true)
      setVendorMode('new')
    }
  }, [mode, autoOpened, vendors.data])
  const [vendor, setVendor] = useState<VendorDraft>(emptyVendor(contractor0 ? { kind: 'individual', withholdingDefault: true } : {}))
  const [price, setPrice] = useState<PriceDraft>(emptyPrice())
  // ドヤAIの「頼む」から来たときは、読み取った名称・金額（円）・開始日を入れた状態にする（保存は本人が押す）
  const [draftYen, setDraftYen] = useState('')
  useDoyaPrefill((read) => {
    if (mode !== 'create') return
    const title = read('title'), amount = read('amount', 'yen'), start = read('start', 'date')
    if (title || start) setF((p) => ({ ...p, title: title || p.title, startDate: start || p.startDate }))
    if (amount) { setPrice((p) => ({ ...p, unitPrice: amount, effectiveFrom: start || p.effectiveFrom })); setDraftYen(amount) }
  })
  // ドヤAIが入れた金額は円。通貨をドルなどに変えたら、円の金額を残さない（そのままドルとして登録されないように）
  useEffect(() => {
    if (!draftYen || f.currency === 'JPY') return
    setPrice((p) => (p.unitPrice === draftYen ? { ...p, unitPrice: '' } : p))
    setDraftYen('')
  }, [f.currency, draftYen])
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const isContractor = f.category === 'contractor'
  const cKey = contractorKey(f.billingModel, Number(f.frequencyMonths))
  const modes: ForecastMode[] = f.billingModel === 'hourly' ? ['planned', 'avg3', 'cap'] : ['planned', 'avg3']
  const showForecast = f.billingModel === 'hourly' || f.billingModel === 'per_deliverable' || f.billingModel === 'variable'

  const pickVendor = (id: string) => {
    setVendorId(id)
    const v = vendors.data?.vendors.find((x) => x.id === id)
    if (v && isContractor) set('withholding', v.withholdingDefault)
  }

  const submit = async () => {
    setBusy(true)
    try {
      const common = {
        title: f.title, category: f.category, billingModel: f.billingModel, frequencyMonths: Number(f.frequencyMonths),
        startDate: f.startDate, endDate: f.endDate || null, autoRenew: f.autoRenew, renewalNoticeDays: Number(f.renewalNoticeDays),
        currency: f.currency, withholding: isContractor ? f.withholding : false, forecastMode: showForecast ? f.forecastMode : 'planned', note: f.note || null,
      }
      if (mode === 'create') {
        const body: Record<string, unknown> = {
          ...common,
          ...(f.anchorDate ? { anchorDate: f.anchorDate } : {}),
          ...(f.paymentMethodId ? { paymentMethodId: f.paymentMethodId } : {}),
          price: priceToPayload({ ...price, effectiveFrom: f.startDate }, f.currency),
          ...(vendorMode === 'existing' ? { vendorId } : { vendor: draftToPayload(vendor, canManage) }),
        }
        const r = await expenseApi<{ contract: Contract }>('/api/expense/contracts', orgSlug, jsonInit('POST', body))
        toast.success('契約を登録しました')
        onSaved(r.contract.id)
      } else {
        const r = await expenseApi<{ contract: Contract }>(`/api/expense/contracts/${initial!.id}`, orgSlug, jsonInit('PATCH', {
          ...common, ...(f.anchorDate ? { anchorDate: f.anchorDate } : {}), paymentMethodId: f.paymentMethodId || null, status: f.status,
        }))
        toast.success('保存しました')
        onSaved(r.contract.id)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ready = f.title.trim() && f.startDate && (mode === 'edit' || (price.unitPrice !== '' && (vendorMode === 'existing' ? !!vendorId : !!vendor.name.trim())))

  return (
    <div className="space-y-4">
      {mode === 'create' && (
        <Card>
          <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">取引先</h2>
          <div className="mb-4 flex gap-4">
            {([['existing', '登録済みから選ぶ'], ['new', '新しく登録する']] as const).map(([k, l]) => (
              <label key={k} className="flex min-h-[44px] items-center gap-2 text-[15px] text-[var(--ink)]">
                <input type="radio" name="vendorMode" checked={vendorMode === k} onChange={() => setVendorMode(k)} className="h-4 w-4 accent-[var(--blue)]" />{l}
              </label>
            ))}
          </div>
          {vendorMode === 'existing' ? (
            <Field label="取引先">
              <select className={inputCls} value={vendorId} onChange={(e) => pickVendor(e.target.value)}>
                <option value="">選んでください</option>
                {(vendors.data?.vendors ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}{v.kind === 'individual' ? '（個人）' : ''}</option>)}
              </select>
            </Field>
          ) : (
            <VendorFields value={vendor} onChange={setVendor} showBank={canManage} hideKind={contractor0} />
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-[18px] font-bold text-[var(--ink)]">契約の内容</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="名称"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={isContractor ? '例: デザイン業務委託' : '例: Notion ビジネスプラン'} /></Field>
          <Field label="カテゴリ">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
          </Field>
        </div>

        {isContractor ? (
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium text-[var(--sub)]">契約の形</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONTRACTOR_FORMS.map((x) => (
                <label key={x.key} className={`cursor-pointer rounded-[var(--r-sm)] border p-3 ${cKey === x.key ? 'border-[var(--blue)] bg-[var(--blue-soft)]' : 'border-[var(--line)]'}`}>
                  <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--ink)]">
                    <input type="radio" name="cform" checked={cKey === x.key} onChange={() => setF((p) => ({ ...p, billingModel: x.billingModel, frequencyMonths: String(x.freq) }))} className="h-4 w-4 accent-[var(--blue)]" />{x.label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-[1.5] text-[var(--sub)]">{x.desc}</span>
                </label>
              ))}
            </div>
            <div className="mt-3"><Check checked={f.withholding} onChange={(v) => set('withholding', v)} label="源泉徴収の対象にする" hint="対象かどうかは、ご自身で判断して設定してください。迷う場合は税理士に確認してください。" /></div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="契約の形">
              <select className={inputCls} value={f.billingModel} onChange={(e) => set('billingModel', e.target.value)}>{BILLING_MODELS.map((b) => <option key={b} value={b}>{BILLING_MODEL_LABEL[b as BillingModel]}</option>)}</select>
            </Field>
            <Field label="支払の周期">
              <select className={inputCls} value={f.frequencyMonths} onChange={(e) => set('frequencyMonths', e.target.value)}>{FREQUENCIES.map((q) => <option key={q} value={q}>{FREQUENCY_LABEL[q]}</option>)}</select>
            </Field>
          </div>
        )}

        {showForecast && (
          <div className="mt-4 max-w-sm">
            <Field label="予定額の出し方" hint={f.billingModel === 'hourly' ? '「上限×単価」を選ぶと、最も多く払う場合の金額で資金繰りを見られます。' : undefined}>
              <select className={inputCls} value={f.forecastMode} onChange={(e) => set('forecastMode', e.target.value)}>{modes.map((m) => <option key={m} value={m}>{FORECAST_MODE_LABEL[m]}</option>)}</select>
            </Field>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="開始日"><input type="date" className={inputCls} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="終了日（なければ空）"><input type="date" className={inputCls} value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
          <Field label="支払の起点日（任意）" hint="空の場合は、開始日の日付を基準にします。カード払いでは、利用日の基準になります。"><input type="date" className={inputCls} value={f.anchorDate} onChange={(e) => set('anchorDate', e.target.value)} /></Field>
          <Field label="通貨">
            <select className={inputCls} value={f.currency} disabled={mode === 'edit'} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c === 'JPY' ? '円' : 'USD（ドル）'}</option>)}</select>
          </Field>
          <Field label="支払方法" hint="未選択の場合は、取引先の支払条件（振込）で計算します。">
            <select className={inputCls} value={f.paymentMethodId} onChange={(e) => set('paymentMethodId', e.target.value)}>
              <option value="">取引先の支払条件（振込）</option>
              {(methods.data?.paymentMethods ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}（{PAYMENT_METHOD_LABEL[m.type]}）</option>)}
            </select>
          </Field>
          {mode === 'edit' && (
            <Field label="状態"><select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>{CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}</select></Field>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <Check checked={f.autoRenew} onChange={(v) => set('autoRenew', v)} label="自動で更新される" />
          <Field label="更新の何日前に知らせる" className="w-40"><input type="number" min={0} className={inputCls} value={f.renewalNoticeDays} onChange={(e) => set('renewalNoticeDays', e.target.value)} /></Field>
        </div>
        <div className="mt-4"><Field label="メモ"><textarea className={inputCls} rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} /></Field></div>
      </Card>

      {mode === 'create' && (
        <Card>
          <h2 className="mb-1 text-[18px] font-bold text-[var(--ink)]">金額</h2>
          {f.currency === 'USD' && <p className="mb-3 text-[13px] text-[var(--sub)]">ドルで入力してください。円への換算には、設定で登録した為替レートを使います。</p>}
          <PriceFields value={price} onChange={setPrice} billingModel={f.billingModel} currency={f.currency} />
        </Card>
      )}

      <div className="flex gap-2">
        <Btn onClick={submit} busy={busy} disabled={!ready}>{mode === 'create' ? '契約を登録する' : '保存する'}</Btn>
      </div>
    </div>
  )
}
