'use client'

// 請求書の手入力（下書き）
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { todayJst } from '@/lib/income/dates'
import { useDoyaPrefill } from '@/components/agent-router/useDoyaPrefill'
import { useAgentForm } from '@/components/agent-chat/useAgentForm'
import { failKindOf, isAgentSubmit } from '@/components/agent-chat/form-bus'
import { createSaveLock } from '@/lib/agent-chat/review'
import {
  Button, Card, emptyLine, ErrorText, Field, LineItemsEditor, PageHeader, PageShell, errMsg, fetchJson, inputCls, linesToPayload, s, safeTotals, toast, useResource,
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
  // ドヤAIの「頼む」から来たときは、読み取った金額（1行目の単価）・件名・支払期日・取引先を入れた状態で開く（保存は本人が押す）
  const [pendingClient, setPendingClient] = useState('')
  useDoyaPrefill((read) => {
    const amount = read('amount', 'yen'), t = read('title'), due = read('due', 'date'), client = read('client')
    if (amount) setRows((r) => (r.length === 1 && !r[0].unitPrice ? [{ ...r[0], unitPrice: amount, name: r[0].name || t }] : r))
    if (t) setTitle(t)
    if (due) setDueDate(due)
    if (client) setPendingClient(client)
  })
  // 取引先は、登録ずみの名前と同じならそれを選び、無ければ「新しい取引先」にその名前を入れる
  useEffect(() => {
    if (!pendingClient || !clientsRes.data) return
    const hit = clientsRes.data.find((c) => c.name.replace(/\s+/g, '') === pendingClient.replace(/\s+/g, ''))
    if (hit) setClientId(hit.id)
    else { setClientId(NEW_CLIENT); setNewClientName(pendingClient) }
    setPendingClient('')
  }, [pendingClient, clientsRes.data])
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

  /**
   * 下書きを保存する。画面のボタンも、会話（AgentDock）の確認ボタンも、この処理を通る（保存の処理はここ1つだけ）。
   * 成功したら、できた下書きの画面へ移る（移ったあとも、会話の欄は枠の側に残り、完了を出す）。
   */
  const saveNow = async (): Promise<{ ok: true; id: string } | { ok: false; error: string; kind?: 'blocked' }> => {
    setTried(true)
    const firstError = Object.values(errors).find(Boolean)
    if (firstError) {
      setError('入力に誤りがあります。赤字の項目を直してください。')
      return { ok: false, error: firstError }
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
      saveLock.close()
      markClean()
      // 会話からの保存では、通知も移動もしない（会話が完了を出してから移る）
      if (!isAgentSubmit()) {
        toast('請求書の下書きを保存しました')
        router.push(`/income/invoices/${d.invoice.id}`)
      }
      return { ok: true, id: d.invoice.id }
    } catch (er) {
      setError(errMsg(er))
      setBusy(false)
      return { ok: false, error: errMsg(er), kind: failKindOf(er) }
    }
  }

  const save = () => saveLock.run(saveNow)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await save()
  }

  // ---- 会話（AgentDock）から操作される口。欄の名前は src/lib/agent-chat/ops.ts の INCOME_INVOICE_DRAFT ----
  const totals = safeTotals(rows)
  const agentTitle = useRef('')
  useAgentForm('income.invoice.new', {
    ready: () => (Boolean(clientsRes.data) || Boolean(clientsRes.error)) && !saveLock.busy(),
    // 取引先の一覧を見る権限がないときは、画面と同じ理由を出して止まる（API が 403 を返す人は、保存もできない）
    blocked: () => (clientsRes.error?.status === 403 ? '請求書を作る権限がありません。組織の管理者（オーナー）に権限の変更を依頼してください。' : clientsRes.error ? '取引先を読み込めませんでした。ページを開き直して、もう一度お試しください。' : null),
    setValue: (key, value) => {
      switch (key) {
        case 'title': {
          // 1字ずつ入れられても、明細の1行目の品目は件名に追いつかせる（本人が自分で直した品目には触らない）
          const prev = agentTitle.current
          agentTitle.current = value
          setTitle(value)
          setRows((r) => r.map((row, i) => (i === 0 && (!row.name.trim() || row.name === prev) ? { ...row, name: value } : row)))
          return true
        }
        case 'amount': setRows((r) => r.map((row, i) => (i === 0 ? { ...row, unitPrice: value } : row))); return true
        case 'client': {
          const fold = (x: string) => x.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
          const hit = clients.find((c) => fold(c.name) === fold(value))
          if (hit) setClientId(hit.id)
          else { setClientId(NEW_CLIENT); setNewClientName(value) }
          return true
        }
        default: return false
      }
    },
    snapshot: () => ({
      client: clientId === NEW_CLIENT ? newClientName.trim() : (clients.find((c) => c.id === clientId)?.name ?? ''),
      title: title.trim(),
      issue: issueDate,
      due: dueDate,
      subtotal: totals ? String(totals.subtotalExclTax) : '',
      tax: totals ? String(totals.taxAmount) : '',
      total: totals ? String(totals.totalInclTax) : '',
    }),
    draft: () => ({ clientId, newClientName, title, issueDate, dueDate, notes, rows }),
    submit: async () => {
      const r = await save()
      return r.ok ? { ok: true, href: `/income/invoices/${r.id}` } : { ok: false, error: r.error, kind: r.kind }
    },
  })

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
              <select className={inputCls} data-agent-field="client" value={clientId} onChange={(e) => setClientId(e.target.value)} onBlur={touch('clientId')} disabled={!clientsRes.data && !clientsRes.error}>
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
              <input className={inputCls} data-agent-field="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="例: 11月分 制作費" />
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
