'use client'

// 請求書の手入力（下書き）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { todayJst } from '@/lib/income/dates'
import { readAmountParam } from '@/app/(shell)/home/quick-request'
import {
  Button, Card, emptyLine, ErrorText, Field, LineItemsEditor, PageHeader, PageShell, errMsg, fetchJson, inputCls, linesToPayload, s, toast, useResource,
  useUnsavedGuard, type LineRow,
} from '@/components/income/ui'

/** 取引先の選択欄で「新しい取引先を登録する」を表す値 */
const NEW_CLIENT = '__new__'

export default function NewInvoicePage() {
  const router = useRouter()
  const clientsRes = useResource(() => fetchJson<{ clients: { id: string; name: string }[] }>('/api/income/clients').then((d) => d.clients), 'clients')
  const clients = clientsRes.data ?? []
  const [clientId, setClientId] = useState('')
  // 取引先をその場で作るときの名前（2026-10-26。取引先を先に登録しなくても請求書を作れる）
  const [newClientName, setNewClientName] = useState('')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState(todayJst())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<LineRow[]>([emptyLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)
  // 経営ホームの「すぐ登録する依頼」から来たときは、1行目の単価に金額を入れた状態で開く（?amount=。保存は本人が押す）
  useEffect(() => {
    const amount = readAmountParam(new URLSearchParams(window.location.search).get('amount'))
    if (amount) setRows((r) => (r.length === 1 && !r[0].unitPrice ? [{ ...r[0], unitPrice: amount }] : r))
  }, [])
  // 取引先が 0 件のときは、最初から「新しい取引先」の入力にする
  useEffect(() => {
    if (clientsRes.data && clientsRes.data.length === 0) setClientId((c) => c || NEW_CLIENT)
  }, [clientsRes.data])
  // 自動で「新しい取引先」にしただけでは、未保存の確認を出さない
  const { markClean } = useUnsavedGuard({ clientId: clientId === NEW_CLIENT && !newClientName ? '' : clientId, newClientName, title, issueDate, dueDate, notes, rows })
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  const errors: Record<string, string | undefined> = {
    clientId: !clientId ? '取引先を選ぶか、新しい取引先を登録してください' : clientId === NEW_CLIENT && !newClientName.trim() ? '新しい取引先の名前を入力してください' : undefined,
    issueDate: issueDate ? undefined : '請求日を入力してください',
    dueDate: dueDate && issueDate && dueDate < issueDate ? '支払期日は請求日以降にしてください' : undefined,
  }
  const err = (k: string) => (touched[k] || tried ? errors[k] : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) {
      setError('入力に誤りがあります。赤字の項目を直してください。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const d = await fetchJson<{ invoice: { id: string } }>('/api/income/invoices', {
        method: 'POST',
        body: {
          ...(clientId === NEW_CLIENT ? { newClientName: newClientName.trim() } : { clientId }),
          title, issueDate, dueDate: dueDate || null, notes, lines: linesToPayload(rows),
        },
      })
      markClean()
      toast('請求書の下書きを保存しました')
      router.push(`/income/invoices/${d.invoice.id}`)
    } catch (er) {
      setError(errMsg(er))
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '請求書', href: '/income/invoices' }, { label: '新規請求書' }]}
        title="新規請求書"
        sub="契約に基づかない請求を手入力で作ります。保存すると下書きになります"
      />
      <form onSubmit={submit} noValidate className="space-y-4">
        <Card title="宛先と日付">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="取引先（必須）"
              error={err('clientId')}
              hint={clientId === NEW_CLIENT ? '名前だけで登録できます。住所や請求先のメールは、あとから取引先の画面で足せます' : undefined}
            >
              <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)} onBlur={touch('clientId')} disabled={!clientsRes.data && !clientsRes.error}>
                <option value="">{clientsRes.data || clientsRes.error ? '選択してください' : '読み込み中です'}</option>
                <option value={NEW_CLIENT}>新しい取引先を登録する</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {clientId === NEW_CLIENT && (
                <input
                  className={`${inputCls} mt-2`}
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onBlur={touch('clientId')}
                  maxLength={120}
                  placeholder="例: 株式会社サンプル商事"
                  aria-label="新しい取引先の名前"
                />
              )}
            </Field>
            <Field label="件名">
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="例: 11月分 制作費" />
            </Field>
            <Field label="請求日（必須）" error={err('issueDate')}>
              <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} onBlur={touch('issueDate')} />
            </Field>
            <Field label="支払期日" error={err('dueDate')} hint="空欄なら、取引先の支払条件から自動で決まります">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={touch('dueDate')} />
            </Field>
          </div>
          {clientsRes.error && <div style={{ marginTop: 16 }}><ErrorText message={clientsRes.error.status === 403 ? '取引先を見る権限がありません。組織の管理者（オーナー）に権限の変更を依頼してください' : '取引先を読み込めませんでした。ページを開き直してください。'} /></div>}
        </Card>
        <Card title="明細">
          <LineItemsEditor rows={rows} onChange={setRows} hint="値引きは単価にマイナスの金額を入力してください（例: -5000）。" />
        </Card>
        <Card>
          <Field label="備考">
            <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </Field>
        </Card>
        <ErrorText message={error} />
        <Button type="submit" variant="primary" loading={busy}>下書きを保存する</Button>
      </form>
    </PageShell>
  )
}
