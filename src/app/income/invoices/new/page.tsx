'use client'

// 請求書の手入力（下書き）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { todayJst } from '@/lib/income/dates'
import {
  Card, emptyLine, ErrorText, Field, LineItemsEditor, PageHeader, PageShell, Spinner, btnPrimary, errMsg, fetchJson, inputCls, linesToPayload, type LineRow,
} from '@/components/income/ui'

export default function NewInvoicePage() {
  const router = useRouter()
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState(todayJst())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<LineRow[]>([emptyLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<{ clients: { id: string; name: string }[] }>('/api/income/clients').then((d) => setClients(d.clients)).catch((e) => setError(errMsg(e)))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const d = await fetchJson<{ invoice: { id: string } }>('/api/income/invoices', {
        method: 'POST',
        body: { clientId, title, issueDate, dueDate: dueDate || null, notes, lines: linesToPayload(rows) },
      })
      router.push(`/income/invoices/${d.invoice.id}`)
    } catch (err) {
      setError(errMsg(err))
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <Link href="/income/invoices" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />請求書の一覧</Link>
      <PageHeader title="新規請求書" sub="契約に基づかない請求を手入力で作ります。保存すると下書きになります" />
      <form onSubmit={submit} className="space-y-4">
        <Card title="宛先と日付">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="取引先（必須）">
              <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">選択してください</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="件名">
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="例: 11月分 制作費" />
            </Field>
            <Field label="請求日（必須）">
              <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </Field>
            <Field label="支払期日" hint="空欄なら、取引先の支払条件から自動で決まります">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
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
        <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Spinner />}下書きを保存する</button>
      </form>
    </PageShell>
  )
}
