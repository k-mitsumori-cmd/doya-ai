'use client'

// 設定: 請求元・支払条件の既定・組織名・支出の取り込み元
import { useEffect, useState } from 'react'
import { MONTH_END } from '@/lib/income/dates'
import {
  Card, ErrorText, Field, Loading, PageHeader, PageShell, PaymentTermsFields, Spinner,
  btnPrimary, errMsg, fetchJson, inputCls, type Terms,
} from '@/components/income/ui'

type Org = { id: string; name: string; slug: string; promaneWorkspaceId: string | null }
type OrgRes = { organization: Org; role: string; promaneWorkspaces: { id: string; name: string }[] }

const EMPTY_ISSUER = {
  companyName: '', postalCode: '', address: '', tel: '', personName: '', invoiceRegNo: '',
  bankName: '', bankBranch: '', bankAccountType: 'ordinary', bankAccountNo: '', bankAccountHolder: '', invoiceNotes: '',
}

export default function SettingsPage() {
  const [org, setOrg] = useState<OrgRes | null>(null)
  const [issuer, setIssuer] = useState(EMPTY_ISSUER)
  const [terms, setTerms] = useState<Terms>({ closingDay: MONTH_END, paymentMonths: 1, paymentDay: MONTH_END })
  const [orgName, setOrgName] = useState('')
  const [wsId, setWsId] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [issuerBusy, setIssuerBusy] = useState(false)
  const [issuerMsg, setIssuerMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [orgBusy, setOrgBusy] = useState(false)
  const [orgMsg, setOrgMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    Promise.all([fetchJson<OrgRes>('/api/income/organization'), fetchJson<{ issuer: any }>('/api/income/issuer')])
      .then(([o, i]) => {
        setOrg(o)
        setOrgName(o.organization.name)
        setWsId(o.organization.promaneWorkspaceId ?? '')
        if (i.issuer) {
          const s = i.issuer
          setIssuer({
            companyName: s.companyName ?? '', postalCode: s.postalCode ?? '', address: s.address ?? '', tel: s.tel ?? '', personName: s.personName ?? '',
            invoiceRegNo: s.invoiceRegNo ?? '', bankName: s.bankName ?? '', bankBranch: s.bankBranch ?? '', bankAccountType: s.bankAccountType ?? 'ordinary',
            bankAccountNo: s.bankAccountNo ?? '', bankAccountHolder: s.bankAccountHolder ?? '', invoiceNotes: s.invoiceNotes ?? '',
          })
          setTerms({ closingDay: s.defaultClosingDay, paymentMonths: s.defaultPaymentMonths, paymentDay: s.defaultPaymentDay })
        }
      })
      .catch((e) => setLoadError(errMsg(e)))
  }, [])

  if (!org) return <PageShell>{loadError ? <ErrorText message={loadError} /> : <Loading />}</PageShell>

  const canEdit = org.role === 'owner' || org.role === 'admin'
  const set = (k: keyof typeof EMPTY_ISSUER) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setIssuer({ ...issuer, [k]: e.target.value })

  const saveIssuer = async (e: React.FormEvent) => {
    e.preventDefault()
    setIssuerBusy(true)
    setIssuerMsg(null)
    try {
      await fetchJson('/api/income/issuer', { method: 'PUT', body: { ...issuer, ...terms } })
      setIssuerMsg({ ok: true, text: '請求元を保存しました' })
    } catch (err) {
      setIssuerMsg({ ok: false, text: errMsg(err) })
    } finally {
      setIssuerBusy(false)
    }
  }

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgBusy(true)
    setOrgMsg(null)
    try {
      await fetchJson('/api/income/organization', { method: 'PATCH', body: { name: orgName } })
      await fetchJson('/api/income/organization', { method: 'PATCH', body: { promaneWorkspaceId: wsId || null } })
      setOrgMsg({ ok: true, text: '保存しました' })
    } catch (err) {
      setOrgMsg({ ok: false, text: errMsg(err) })
    } finally {
      setOrgBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader title="設定" sub="請求書に載せる請求元の情報と、支出の取り込み元を設定します" />
      {!canEdit && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">設定を変更できるのは、オーナーと管理者だけです（表示のみ）。</p>}

      <form onSubmit={saveIssuer} className="mb-4 space-y-4">
        <fieldset disabled={!canEdit || issuerBusy} className="space-y-4">
          <Card title="請求元">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="自社名（必須）" className="sm:col-span-2"><input className={inputCls} value={issuer.companyName} onChange={set('companyName')} maxLength={120} required /></Field>
              <Field label="郵便番号"><input className={inputCls} value={issuer.postalCode} onChange={set('postalCode')} maxLength={10} /></Field>
              <Field label="電話番号"><input className={inputCls} value={issuer.tel} onChange={set('tel')} maxLength={30} /></Field>
              <Field label="住所" className="sm:col-span-2"><input className={inputCls} value={issuer.address} onChange={set('address')} maxLength={300} /></Field>
              <Field label="担当者名"><input className={inputCls} value={issuer.personName} onChange={set('personName')} maxLength={60} /></Field>
              <Field label="登録番号（インボイス）" hint="T＋13桁の数字"><input className={inputCls} value={issuer.invoiceRegNo} onChange={set('invoiceRegNo')} maxLength={14} placeholder="T1234567890123" /></Field>
            </div>
          </Card>
          <Card title="振込先">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="銀行名"><input className={inputCls} value={issuer.bankName} onChange={set('bankName')} maxLength={60} /></Field>
              <Field label="支店名"><input className={inputCls} value={issuer.bankBranch} onChange={set('bankBranch')} maxLength={60} /></Field>
              <Field label="口座種別">
                <select className={inputCls} value={issuer.bankAccountType} onChange={set('bankAccountType')}>
                  <option value="ordinary">普通</option>
                  <option value="checking">当座</option>
                </select>
              </Field>
              <Field label="口座番号"><input className={inputCls} value={issuer.bankAccountNo} onChange={set('bankAccountNo')} maxLength={20} inputMode="numeric" /></Field>
              <Field label="口座名義" className="sm:col-span-2"><input className={inputCls} value={issuer.bankAccountHolder} onChange={set('bankAccountHolder')} maxLength={100} /></Field>
            </div>
          </Card>
          <Card title="支払条件の既定" right={<span className="text-[11px] font-bold text-slate-400">取引先ごとの指定がないときに使います</span>}>
            <PaymentTermsFields value={terms} onChange={setTerms} allowDefault={false} />
          </Card>
          <Card title="請求書の備考">
            <textarea className={inputCls} rows={3} value={issuer.invoiceNotes} onChange={set('invoiceNotes')} maxLength={1000} placeholder="すべての請求書の末尾に載せる文面" />
          </Card>
        </fieldset>
        {issuerMsg && (issuerMsg.ok ? <p className="text-xs font-black text-[#0f9f6e]">{issuerMsg.text}</p> : <ErrorText message={issuerMsg.text} />)}
        {canEdit && <button type="submit" disabled={issuerBusy} className={btnPrimary}>{issuerBusy && <Spinner />}請求元を保存する</button>}
      </form>

      <form onSubmit={saveOrg}>
        <fieldset disabled={!canEdit || orgBusy} className="space-y-4">
          <Card title="組織と支出の取り込み元">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="組織名"><input className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} maxLength={80} required /></Field>
              <Field label="支出の取り込み元（ドヤプロマネ）">
                <select className={inputCls} value={wsId} onChange={(e) => setWsId(e.target.value)}>
                  <option value="">連携しない</option>
                  {org.promaneWorkspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            </div>
            <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">支出は、選んだドヤプロマネのワークスペースの記録（プロジェクト経費＋人件費）を暫定的に使い、ダッシュボードの粗利を出します。財務を閲覧できるワークスペースだけが選べます。</p>
          </Card>
        </fieldset>
        <div className="mt-3 space-y-2">
          {orgMsg && (orgMsg.ok ? <p className="text-xs font-black text-[#0f9f6e]">{orgMsg.text}</p> : <ErrorText message={orgMsg.text} />)}
          {canEdit && <button type="submit" disabled={orgBusy} className={btnPrimary}>{orgBusy && <Spinner />}保存する</button>}
        </div>
      </form>
    </PageShell>
  )
}
