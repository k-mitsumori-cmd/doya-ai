'use client'

// 設定: 請求元・支払条件の既定・組織名・支出の取り込み元
import { useState } from 'react'
import { MONTH_END } from '@/lib/income/dates'
import {
  Button, Card, DetailSkeleton, ErrorText, Field, Gate, PageHeader, PageShell, PaymentTermsFields,
  errMsg, fetchJson, inputCls, s, toast, useResource, useUnsavedGuard, type Terms,
} from '@/components/income/ui'

type Org = { id: string; name: string; slug: string; promaneWorkspaceId: string | null }
type OrgRes = { organization: Org; role: string; promaneWorkspaces: { id: string; name: string }[] }
type Loaded = { org: OrgRes; issuer: any }

const EMPTY_ISSUER = {
  companyName: '', postalCode: '', address: '', tel: '', personName: '', invoiceRegNo: '',
  bankName: '', bankBranch: '', bankAccountType: 'ordinary', bankAccountNo: '', bankAccountHolder: '', invoiceNotes: '',
}

function SettingsForms({ org, issuer: loadedIssuer }: Loaded) {
  const init = (() => {
    const s0 = loadedIssuer
    if (!s0) return { issuer: EMPTY_ISSUER, terms: { closingDay: MONTH_END, paymentMonths: 1, paymentDay: MONTH_END } as Terms }
    return {
      issuer: {
        companyName: s0.companyName ?? '', postalCode: s0.postalCode ?? '', address: s0.address ?? '', tel: s0.tel ?? '', personName: s0.personName ?? '',
        invoiceRegNo: s0.invoiceRegNo ?? '', bankName: s0.bankName ?? '', bankBranch: s0.bankBranch ?? '', bankAccountType: s0.bankAccountType ?? 'ordinary',
        bankAccountNo: s0.bankAccountNo ?? '', bankAccountHolder: s0.bankAccountHolder ?? '', invoiceNotes: s0.invoiceNotes ?? '',
      },
      terms: { closingDay: s0.defaultClosingDay, paymentMonths: s0.defaultPaymentMonths, paymentDay: s0.defaultPaymentDay } as Terms,
    }
  })()
  const [issuer, setIssuer] = useState(init.issuer)
  const [terms, setTerms] = useState<Terms>(init.terms)
  const [orgName, setOrgName] = useState(org.organization.name)
  const [wsId, setWsId] = useState(org.organization.promaneWorkspaceId ?? '')
  const [issuerBusy, setIssuerBusy] = useState(false)
  const [issuerError, setIssuerError] = useState<string | null>(null)
  const [orgBusy, setOrgBusy] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState<{ issuer: boolean; org: boolean }>({ issuer: false, org: false })
  const issuerGuard = useUnsavedGuard({ issuer, terms })
  const orgGuard = useUnsavedGuard({ orgName, wsId })

  const canEdit = org.role === 'owner' || org.role === 'admin'
  const set = (k: keyof typeof EMPTY_ISSUER) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setIssuer({ ...issuer, [k]: e.target.value })
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  const issuerErrors: Record<string, string | undefined> = {
    companyName: issuer.companyName.trim() ? undefined : '自社名を入力してください',
    invoiceRegNo: issuer.invoiceRegNo.trim() !== '' && !/^T\d{13}$/.test(issuer.invoiceRegNo.normalize('NFKC').trim()) ? '登録番号は「T」と13桁の数字で入力してください' : undefined,
    bankAccountNo: issuer.bankAccountNo.trim() !== '' && !/^\d{1,8}$/.test(issuer.bankAccountNo.normalize('NFKC').trim()) ? '口座番号は数字で入力してください' : undefined,
  }
  const orgErrors: Record<string, string | undefined> = { orgName: orgName.trim() ? undefined : '組織名を入力してください' }
  const ierr = (k: string) => (touched[k] || tried.issuer ? issuerErrors[k] : undefined)
  const oerr = (k: string) => (touched[k] || tried.org ? orgErrors[k] : undefined)

  const saveIssuer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried((t) => ({ ...t, issuer: true }))
    if (Object.values(issuerErrors).some(Boolean)) { setIssuerError('入力に誤りがあります。赤字の項目を直してください。'); return }
    setIssuerBusy(true)
    setIssuerError(null)
    try {
      await fetchJson('/api/income/issuer', { method: 'PUT', body: { ...issuer, ...terms } })
      issuerGuard.markClean()
      toast('請求元を保存しました')
    } catch (err) {
      setIssuerError(errMsg(err))
    } finally {
      setIssuerBusy(false)
    }
  }

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried((t) => ({ ...t, org: true }))
    if (Object.values(orgErrors).some(Boolean)) { setOrgError('入力に誤りがあります。赤字の項目を直してください。'); return }
    setOrgBusy(true)
    setOrgError(null)
    try {
      await fetchJson('/api/income/organization', { method: 'PATCH', body: { name: orgName } })
      await fetchJson('/api/income/organization', { method: 'PATCH', body: { promaneWorkspaceId: wsId || null } })
      orgGuard.markClean()
      toast('組織の設定を保存しました')
    } catch (err) {
      setOrgError(errMsg(err))
    } finally {
      setOrgBusy(false)
    }
  }

  return (
    <>
      {!canEdit && <p className={s.note} style={{ margin: '0 0 16px' }}>設定を変更できるのは、オーナーと管理者だけです（表示のみ）。変更したいときは、組織の管理者（オーナー）に権限の変更を依頼してください。</p>}

      <form onSubmit={saveIssuer} noValidate className="mb-4 space-y-4">
        <fieldset disabled={!canEdit || issuerBusy} className={`${s.fieldset} space-y-4`}>
          <Card title="請求元">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="自社名（必須）" error={ierr('companyName')} className="sm:col-span-2"><input className={inputCls} value={issuer.companyName} onChange={set('companyName')} onBlur={touch('companyName')} maxLength={120} /></Field>
              <Field label="郵便番号"><input className={inputCls} value={issuer.postalCode} onChange={set('postalCode')} maxLength={10} /></Field>
              <Field label="電話番号"><input className={inputCls} value={issuer.tel} onChange={set('tel')} maxLength={30} /></Field>
              <Field label="住所" className="sm:col-span-2"><input className={inputCls} value={issuer.address} onChange={set('address')} maxLength={300} /></Field>
              <Field label="担当者名"><input className={inputCls} value={issuer.personName} onChange={set('personName')} maxLength={60} /></Field>
              <Field label="登録番号（インボイス）" error={ierr('invoiceRegNo')} hint="T＋13桁の数字"><input className={inputCls} value={issuer.invoiceRegNo} onChange={set('invoiceRegNo')} onBlur={touch('invoiceRegNo')} maxLength={14} placeholder="T1234567890123" /></Field>
            </div>
          </Card>
          <Card title="振込先">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="銀行名"><input className={inputCls} value={issuer.bankName} onChange={set('bankName')} maxLength={60} /></Field>
              <Field label="支店名"><input className={inputCls} value={issuer.bankBranch} onChange={set('bankBranch')} maxLength={60} /></Field>
              <Field label="口座種別">
                <select className={inputCls} value={issuer.bankAccountType} onChange={set('bankAccountType')}>
                  <option value="ordinary">普通</option>
                  <option value="checking">当座</option>
                </select>
              </Field>
              <Field label="口座番号" error={ierr('bankAccountNo')}><input className={inputCls} value={issuer.bankAccountNo} onChange={set('bankAccountNo')} onBlur={touch('bankAccountNo')} maxLength={20} inputMode="numeric" /></Field>
              <Field label="口座名義" className="sm:col-span-2"><input className={inputCls} value={issuer.bankAccountHolder} onChange={set('bankAccountHolder')} maxLength={100} /></Field>
            </div>
          </Card>
          <Card title="支払条件の既定" right={<span className={s.sub}>取引先ごとの指定がないときに使います</span>}>
            <PaymentTermsFields value={terms} onChange={setTerms} allowDefault={false} />
          </Card>
          <Card title="請求書の備考">
            <textarea className={inputCls} rows={3} aria-label="請求書の備考" value={issuer.invoiceNotes} onChange={set('invoiceNotes')} maxLength={1000} placeholder="すべての請求書の末尾に載せる文面" />
          </Card>
        </fieldset>
        <ErrorText message={issuerError} />
        {canEdit && <Button type="submit" variant="primary" loading={issuerBusy}>請求元を保存する</Button>}
      </form>

      <form onSubmit={saveOrg} noValidate>
        <fieldset disabled={!canEdit || orgBusy} className={`${s.fieldset} space-y-4`}>
          <Card title="組織と支出の取り込み元">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="組織名" error={oerr('orgName')}><input className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} onBlur={touch('orgName')} maxLength={80} /></Field>
              <Field label="支出の取り込み元（ドヤプロマネ）">
                <select className={inputCls} value={wsId} onChange={(e) => setWsId(e.target.value)}>
                  <option value="">連携しない</option>
                  {org.promaneWorkspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            </div>
            <p className={s.sub} style={{ margin: '12px 0 0' }}>支出は、選んだドヤプロマネのワークスペースの記録（プロジェクト経費＋人件費）を暫定的に使い、ダッシュボードの粗利を出します。財務を閲覧できるワークスペースだけが選べます。</p>
          </Card>
        </fieldset>
        <div className="mt-4 space-y-3">
          <ErrorText message={orgError} />
          {canEdit && <Button type="submit" loading={orgBusy}>組織の設定を保存する</Button>}
        </div>
      </form>
    </>
  )
}

export default function SettingsPage() {
  const res = useResource<Loaded>(
    () => Promise.all([fetchJson<OrgRes>('/api/income/organization'), fetchJson<{ issuer: any }>('/api/income/issuer')]).then(([org, i]) => ({ org, issuer: i.issuer })),
    'settings',
  )
  return (
    <PageShell>
      <PageHeader crumbs={[{ label: '収入管理', href: '/income' }, { label: '設定' }]} title="設定" sub="請求書に載せる請求元の情報と、支出の取り込み元を設定します" />
      <Gate res={res} skeleton={<DetailSkeleton cards={3} />}>
        {(d) => <SettingsForms org={d.org} issuer={d.issuer} />}
      </Gate>
    </PageShell>
  )
}
