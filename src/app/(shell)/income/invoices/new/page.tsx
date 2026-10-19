'use client'

// 請求書の手入力（下書き）
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { todayJst } from '@/lib/income/dates'
import {
  Button, Card, emptyLine, ErrorText, Field, LineItemsEditor, PageHeader, PageShell, errMsg, fetchJson, inputCls, linesToPayload, s, toast, useResource,
  useUnsavedGuard, type LineRow,
} from '@/components/income/ui'

export default function NewInvoicePage() {
  const router = useRouter()
  const clientsRes = useResource(() => fetchJson<{ clients: { id: string; name: string }[] }>('/api/income/clients').then((d) => d.clients), 'clients')
  const clients = clientsRes.data ?? []
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState(todayJst())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<LineRow[]>([emptyLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)
  const { markClean } = useUnsavedGuard({ clientId, title, issueDate, dueDate, notes, rows })
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  const errors: Record<string, string | undefined> = {
    clientId: clientId ? undefined : '取引先を選択してください',
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
        body: { clientId, title, issueDate, dueDate: dueDate || null, notes, lines: linesToPayload(rows) },
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
            <Field label="取引先（必須）" error={err('clientId')}>
              <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)} onBlur={touch('clientId')}>
                <option value="">選択してください</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
          {clientsRes.data && clients.length === 0 && (
            <p className={s.note} style={{ margin: '16px 0 0' }}>取引先がまだありません。先に <Link href="/income/clients" className={s.link}>取引先を登録</Link> してください。</p>
          )}
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
