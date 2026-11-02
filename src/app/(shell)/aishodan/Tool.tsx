'use client'

// ============================================
// ドヤAI商談 ダッシュボード（ホスト向け）
// ============================================
// 商材登録 → ルーム発行 → 商談ログ確認 を1画面で回す。
// 設定を全部埋めないと始められない作りにすると、最初の商談に到達しない。
// URLを1本入れれば、既定のシナリオまで自動で用意される。

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { clearSelectedOrg, reconcileSelectedOrg, withOrg, type Membership } from '@/components/org/OrgSwitcher'
import { SESSION_STATUS_LABELS, VERDICT_LABELS, type Verdict } from '@/lib/aishodan/types'
import AishodanLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import LoadingProgress from '@/components/LoadingProgress'
import { appendAishodanPage, parseAishodanPage } from '@/lib/aishodan/list-pages'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { Button, EmptyState, FirstSteps, Skeleton, StatTile, ToolHero } from '@/components/ds'
import { Stagger, StaggerItem } from '@/components/ds/motion'
import { AISHODAN_TAP, AishodanFailureNotice, AishodanHttpError, describeAishodanFailure, failureStatus, fetchAishodanJson, type AishodanFailure } from '@/components/aishodan/failure'
import { ShellCostBadge } from '@/components/shell/power'
import { confirmDialog } from '@/components/ds/dialog'

interface Product {
  id: string
  name: string
  sourceUrl: string | null
  scenarios: Array<{ id: string; name: string }>
  _count: { chunks: number; sources: number }
}
interface Room {
  id: string
  name: string
  token: string
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  sessionCount: number
  maxSessions: number
  scenario: { id: string; name: string; product: { name: string } }
  _count: { sessions: number }
}
interface SessionRow {
  id: string
  guestName: string | null
  guestCompany: string | null
  status: string
  createdAt: string
  room: { name: string }
  outcome: { fitScore: number; verdict: string } | null
  _count: { turns: number }
}
interface Stats {
  total: number
  evaluated: number
  completionRate: number
  scheduled: number
  schedulingRate: number
  avgMin: number
  byVerdict: Record<string, number>
  unanswered: Array<{ id: string; text: string; count: number }>
}

const VERDICT_STYLE: Record<string, string> = {
  hot: 'bg-rose-50 text-rose-700',
  warm: 'bg-amber-50 text-amber-700',
  cold: 'bg-slate-100 text-slate-600',
  unfit: 'bg-slate-100 text-slate-500',
}

export default function AishodanTool() {
  // 新しい見た目（UI 品質 §5.1）: 全画面の高さ・読み込みを出さない（C-2）、ToolHero・StatTile・空状態の絵。
  // ページの見出しは h2（h1 は枠の ToolFrame）
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<{ slug: string; name: string; role: string } | null>(null)
  const [orgName, setOrgName] = useState('')
  const [, setMemberships] = useState<Membership[]>([])
  /** 未ログイン。⚠️ 組織が無いのか、そもそもログインしていないのかを区別する。
   *  区別しないと、未ログインの人に「組織を作成」フォームを見せてしまい、
   *  押しても401で何も起きない（何が悪いのか分からない画面になる）。 */
  const [needsLogin, setNeedsLogin] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  /** 削除中の対象ID。⚠️ 連打で二重に消しにいかないよう、押した行だけ止める */
  const [deletingId, setDeletingId] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [productCursor, setProductCursor] = useState<string | null>(null)
  const [roomCursor, setRoomCursor] = useState<string | null>(null)
  const [productTotal, setProductTotal] = useState(0)
  const [roomTotal, setRoomTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState<'products' | 'rooms' | null>(null)
  const loadVersion = useRef(0)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const oneButton = useOneButton()
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importIssue, setImportIssue] = useState<{ message: string; upgradeUrl?: string; failure?: AishodanFailure } | null>(null)

  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  // サーバーの文の代わりに出す「何が起きたか・どうすればよいか」（UI 品質 S-20）
  const [loadFailure, setLoadFailure] = useState<AishodanFailure | null>(null)
  const [actionFailure, setActionFailure] = useState<AishodanFailure | null>(null)
  useEffect(() => {
    if (!error) setActionFailure(null)
  }, [error])
  /** 新しい見た目では利用者向けの文に直す。今までの見た目は、今までどおりサーバーの文を出す */
  function reportFailure(e: unknown, subject: string, fallback: string) {
    const f = describeAishodanFailure(failureStatus(e), subject, {
      serverMessage: e instanceof AishodanHttpError ? e.message : undefined,
      limit: e instanceof AishodanHttpError && e.code === 'LIMIT_REACHED',
    })
    setActionFailure(f)
    notifyError(setError, f.what)
  }
  // 新しい見た目のボタン・リンク: 押せる大きさとキーボードの枠
  const tap = AISHODAN_TAP

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    setError('')
    setLoadFailure(null)
    setNeedsLogin(false)
    setOrg(null)
    setProducts([])
    setRooms([])
    setSessions([])
    setStats(null)
    setProductCursor(null)
    setRoomCursor(null)
    setLoadingMore(null)
    try {
      const r = await fetch('/api/aishodan/organizations')
      if (r.status === 401) {
        if (version === loadVersion.current) setNeedsLogin(true)
        return
      }
      if (!r.ok) throw new AishodanHttpError('組織一覧を取得できませんでした', r.status)
      let d = await r.json()
      const memberships = Array.isArray(d.memberships) ? d.memberships : []
      if (reconcileSelectedOrg('aishodan', memberships)) {
        const scoped = await fetch(withOrg('aishodan', '/api/aishodan/organizations'))
        if (!scoped.ok) throw new AishodanHttpError('選択中の組織を確認できませんでした', scoped.status)
        const scopedData = await scoped.json()
        if (scopedData?.current) d = scopedData
        else clearSelectedOrg('aishodan')
      }
      if (d.current) {
        const [pr, rr, sr, st] = await Promise.all([
          // fetchOrgJson と同じ動き。失敗したときに応答の状態（403・上限など）も分かる
          fetchAishodanJson(withOrg('aishodan', '/api/aishodan/products')),
          fetchAishodanJson(withOrg('aishodan', '/api/aishodan/rooms')),
          fetchAishodanJson(withOrg('aishodan', '/api/aishodan/sessions')),
          fetchAishodanJson<Stats>(withOrg('aishodan', '/api/aishodan/stats')),
        ])
        if (!Array.isArray(sr.sessions)) {
          throw new Error('組織のデータを確認できませんでした')
        }
        const productPage = parseAishodanPage<Product>(pr, 'products', 100)
        const roomPage = parseAishodanPage<Room>(rr, 'rooms', 100)
        if (version !== loadVersion.current) return
        setOrg(d.current)
        setMemberships(memberships)
        setProducts(productPage.items)
        setProductCursor(productPage.nextCursor)
        setProductTotal(productPage.total)
        setRooms(roomPage.items)
        setRoomCursor(roomPage.nextCursor)
        setRoomTotal(roomPage.total)
        setSessions(sr.sessions || [])
        setStats(st)
      } else if (version === loadVersion.current) {
        setMemberships(memberships)
      }
    } catch (e) {
      if (version === loadVersion.current) {
        // 新しい見た目では、画面にもトーストにも、サーバーの文ではなく状態に合わせた文を出す
        const failure = describeAishodanFailure(failureStatus(e), '商談のデータを読み込めませんでした。')
        setLoadFailure(failure)
        notifyError(setError, failure.what)
      }
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [])

  async function loadMore(kind: 'products' | 'rooms') {
    const cursor = kind === 'products' ? productCursor : roomCursor
    if (!cursor || loadingMore) return
    const version = loadVersion.current
    setLoadingMore(kind)
    setError('')
    try {
      const data = await fetchAishodanJson(withOrg('aishodan', `/api/aishodan/${kind}?cursor=${encodeURIComponent(cursor)}`))
      if (version !== loadVersion.current) return
      if (kind === 'products') {
        const page = parseAishodanPage<Product>(data, kind, 100)
        setProducts(appendAishodanPage(products, page, productTotal))
        setProductCursor(page.nextCursor)
      } else {
        const page = parseAishodanPage<Room>(data, kind, 100)
        setRooms(appendAishodanPage(rooms, page, roomTotal))
        setRoomCursor(page.nextCursor)
      }
    } catch (e) {
      if (version === loadVersion.current) reportFailure(e, '続きを読み込めませんでした。', '続きを取得できませんでした')
    } finally {
      if (version === loadVersion.current) setLoadingMore(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  async function createOrg() {
    if (!orgName.trim()) return
    setError('')
    const r = await fetch(withOrg('aishodan', '/api/aishodan/organizations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName.trim() }),
    })
    if (!r.ok) {
      const message = (await r.json().catch(() => ({})))?.error || '作成に失敗しました'
      setActionFailure(describeAishodanFailure(r.status, '組織を作成できませんでした。', { serverMessage: message }))
      setError(message)
      return
    }
    await load()
  }

  async function importProduct() {
    if (!url.trim()) return
    setImporting(true)
    setError('')
    setImportResult(null)
    setImportIssue(null)
    let upgradeUrl: string | undefined
    try {
      const r = await fetch(withOrg('aishodan', '/api/aishodan/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const d = await r.json()
      if (!r.ok) {
        if (r.status === 402 && d?.code === 'LIMIT_REACHED' && d?.upgradeUrl === '/aishodan/pricing') upgradeUrl = d.upgradeUrl
        throw new AishodanHttpError(d?.error || '取り込みに失敗しました', r.status, d?.code)
      }
      setImportResult(`「${d.product.name}」を取り込みました（${d.pageCount}ページ / ${d.chunkCount}件のナレッジ）`)
      setUrl('')
      await load()
    } catch (e) {
      const message = e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : '取り込みに失敗しました'
      // 新しい見た目では、サーバーの文ではなく「何が起きたか・どうすればよいか」を出す（上限なら料金プランへ）
      const failure = describeAishodanFailure(failureStatus(e), '商材を取り込めませんでした。', { serverMessage: e instanceof AishodanHttpError ? message : undefined, limit: !!upgradeUrl })
      setImportIssue({ message, upgradeUrl, failure })
      notifyError(setError, failure ? failure.what : message)
    } finally {
      setImporting(false)
    }
  }

  async function issueRoom(scenarioId: string) {
    setIssuing(true)
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', '/api/aishodan/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      })
      const d = await r.json()
      if (!r.ok) throw new AishodanHttpError(d?.error || 'ルームを発行できませんでした', r.status, d?.code)
      await load()
    } catch (e) {
      reportFailure(e, '商談URLを発行できませんでした。', 'ルームを発行できませんでした')
    } finally {
      setIssuing(false)
    }
  }

  /** 商談記録がある商材は保管し、記録を残して利用枠を空ける。 */
  async function deleteProduct(prod: Product) {
    const warn = [
      '商談の記録がある場合: 商材と記録を保管して、無料枠を空けます。配った商談URLは開けなくなります。',
      '商談の記録がない場合: 商材・ナレッジ・シナリオを削除します。元に戻せません。',
      `ナレッジ ${prod._count.chunks}件 / 取り込んだ ${prod._count.sources}ページ`,
    ].join('\n')
    if (!(await confirmDialog({ title: `「${prod.name}」の利用を終えますか？`, message: warn, confirmLabel: '利用を終える', tone: 'danger' }))) return

    setDeletingId(prod.id)
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', `/api/aishodan/products/${prod.id}`), {
        method: 'DELETE',
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new AishodanHttpError(d?.error || '削除できませんでした', r.status, d?.code)
      await load()
      setImportResult(d.archived ? `「${prod.name}」を保管しました。商談記録は残り、商談URLの公開は停止しました。` : `「${prod.name}」を削除しました。`)
    } catch (e) {
      reportFailure(e, '商材を削除・保管できませんでした。', '削除できませんでした')
    } finally {
      setDeletingId('')
    }
  }

  /**
   * 商談URLを削除する。
   * 商談記録があるURLは公開停止で保管し、削除しない。
   */
  async function deleteRoom(room: Room) {
    if (room._count.sessions > 0) {
      setActionFailure({ kind: 'other', what: `この商談URLには記録が${room._count.sessions}件あるため削除できません。`, how: '「公開を停止」を押すと、新しく開かれなくなります。記録は残ります。' })
      notifyError(setError, `この商談URLには記録が${room._count.sessions}件あるため削除できません。「公開を停止」で新規アクセスを止めてください。`)
      return
    }
    const warn = [
      // ⚠️ 名前は同じものが並ぶ。URLと発行日まで出さないと取り違える
      roomUrl(room.token),
      `（${new Date(room.createdAt).toLocaleString('ja-JP')} 発行）`,
      '配ったURLは開けなくなります。元に戻せません。',
    ].join('\n')
    if (!(await confirmDialog({ title: `商談URL「${room.name}」を削除しますか？`, message: warn, confirmLabel: '削除する', tone: 'danger' }))) return

    setDeletingId(room.id)
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', `/api/aishodan/rooms/${room.id}`), {
        method: 'DELETE',
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new AishodanHttpError(d?.error || '削除できませんでした', r.status, d?.code)
      await load()
    } catch (e) {
      reportFailure(e, '商談URLを削除できませんでした。', '削除できませんでした')
    } finally {
      setDeletingId('')
    }
  }

  async function toggleRoom(room: Room) {
    await fetch(withOrg('aishodan', `/api/aishodan/rooms/${room.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !room.isActive }),
    })
    await load()
  }

  /**
   * 削除できる権限があるか。
   * ⚠️ APIは admin 以上を要求する。権限が無い人にボタンを見せると、
   *    押しても403になるだけで何が悪いのか分からない画面になる。
   */
  const canDelete = org?.role === 'owner' || org?.role === 'admin'

  function roomUrl(token: string) {
    return typeof window !== 'undefined' ? `${window.location.origin}/m/${token}` : `/m/${token}`
  }

  async function copyUrl(token: string) {
    try {
      await navigator.clipboard.writeText(roomUrl(token))
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setActionFailure({ kind: 'other', what: 'URLをコピーできませんでした。', how: 'URLの文字を長押し（または選択）して、コピーしてください。' })
      notifyError(setError, 'コピーできませんでした。URLを選択してコピーしてください。')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6" aria-busy="true" aria-label="読み込み中">
        <Skeleton lines={2} height={28} />
        <Skeleton lines={4} height={18} />
      </div>
    )
  }


  // ⚠️ 未ログインの方にはLPを見せる。以前は「ログインが必要です」の小さな箱だけで、
  //    何をするサービスなのか説明する面がどこにも無かった。
  if (needsLogin) {
    return <AishodanLp />
  }

  if (!org && error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <AishodanFailureNotice
          failure={loadFailure ?? describeAishodanFailure(0, '商談のデータを読み込めませんでした。')}
          onRetry={() => void load()}
          retryLabel="もう一度読み込む"
        />
      </div>
    )
  }


  if (!org) {
    return (
      <div className="flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900">AI商談をはじめましょう</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 font-semibold">
            はじめに、商談を行う組織を作成してください。
          </p>
          {/* 新しい見た目: 入力欄に名前を付け、エラーは入力欄と結び付けて読み上げる（UI 品質 a11y） */}
          <label htmlFor="aishodan-org-name" className="mt-5 block text-xs font-bold text-slate-600">組織名</label>
          <input
            id="aishodan-org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="見本 株式会社"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'aishodan-org-error' : undefined}
            className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
          />
          {error ? (
            <p id="aishodan-org-error" role="alert" className="mt-3 text-sm text-rose-600 font-semibold">
              {actionFailure ? `${actionFailure.what}${actionFailure.how}` : error}
            </p>
          ) : error && <p className="mt-3 text-sm text-rose-600 font-semibold">{error}</p>}
          <button
            onClick={createOrg}
            disabled={!orgName.trim()}
            className={`mt-4 w-full rounded-lg bg-[#0066ff] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0${tap}`}
          >
            組織を作成する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={importing}
        operationKey="aishodan-import"
        title="商材を読み取っています"
        subtitle="サービスページから商材ナレッジと商談シナリオを組み立てています。"
        tips={['資料を足すほど、答えられる質問の範囲が広がります', '根拠が無い質問には推測で答えず記録に残します', 'シナリオは生成後に編集できます']}
      />
      {/* 新しい見た目では、ページの見出しの帯の代わりに ToolHero（組織の切り替えは枠の ToolFrame にある） */}
      <div className="mx-auto grid max-w-5xl gap-4 px-4 pt-4 sm:pt-6">
          {oneButton ? (
            <OneButtonBar
              eyebrow="ドヤAI商談"
              cta={importing ? '商材を読み取っています。このままお待ちください' : '自社サービスの URL を入れたら、押してください'}
              label="取り込む"
              scope="入れた URL のサイトを読み、商材のナレッジと既定の商談シナリオを作ります。"
              onRun={() => void importProduct()}
              disabled={importing || !url.trim()}
              disabledReason="自社サービスの URL を入れると押せます。"
              running={importing}
            />
          ) : null}
          <ToolHero
            title="AIが一次商談を進め、適合度まで残す。"
            lead="自社サービスのURLを取り込むと、AIが商材を覚えて商談のシナリオを作ります。発行したURLを送るだけで、相手はログインせずに商談を始められます。"
            tool="aishodan"
          />
          <FirstSteps
            id="aishodan"
            steps={[
              { title: '商材を取り込む', body: '自社サービスのURLを入れると、ナレッジとシナリオができます。' },
              { title: '商談URLを発行する', body: 'メール・LP・広告のリンク先に置けます。' },
              { title: '商談の記録を見る', body: '発話の記録と、適合度の判定が残ります。' },
            ]}
          />
        </div>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* 新しい見た目: サーバーの文ではなく「何が起きたか・どうすればよいか」（商材の取り込みの失敗は、取り込み欄の下に出す） */}
        {(
          actionFailure && <AishodanFailureNotice failure={actionFailure} />
        )}

        {/* 指標 */}
        {stats && stats.total > 0 && (
          <Stagger as="section" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StaggerItem index={0}><StatTile label="保存期間内の商談数" value={stats.total} unit="件" icon="MessagesSquare" href="/aishodan/sessions" /></StaggerItem>
            <StaggerItem index={1}><StatTile label="完了率" value={stats.completionRate} unit="%" icon="CheckSquare" /></StaggerItem>
            <StaggerItem index={2}><StatTile label="平均所要" value={stats.avgMin} unit="分" icon="Timer" /></StaggerItem>
            <StaggerItem index={3}><StatTile label="日程調整" value={stats.scheduled} unit="件" icon="CalendarDays" sub={`調整率 ${stats.schedulingRate}%`} /></StaggerItem>
          </Stagger>
        )}

        {/* 1. 商材を取り込む */}
        <section id="aishodan-import" className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
          <h2 className="text-base font-bold text-slate-900">1. 商材を取り込む</h2>
          <p className="mt-1 text-sm text-slate-600 font-semibold">
            自社サービスのURLを入力すると、サイトを読み取ってナレッジを作り、既定の商談シナリオまで用意します。
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              id="aishodan-import-url"
              aria-label="自社サービスのURL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/service"
              type="url"
              inputMode="url"
              aria-invalid={importIssue ? true : undefined}
              aria-describedby={importIssue ? 'aishodan-import-issue' : undefined}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold min-w-0"
            />
            <button
              onClick={importProduct}
              disabled={importing || !url.trim()}
              className={`rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0 whitespace-nowrap motion-reduce:transition-none motion-reduce:hover:translate-y-0${tap}`}
            >
              {importing ? '取り込み中...' : '取り込む'}
            </button>
          </div>
          {importIssue?.failure ? (
            <div id="aishodan-import-issue" className="mt-3">
              <AishodanFailureNotice failure={importIssue.failure} />
            </div>
          ) : importIssue && (
            <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              <p>{importIssue.message}</p>
              {importIssue.upgradeUrl && <Link href={importIssue.upgradeUrl} className="mt-2 inline-block text-blue-700 underline">プロプランの料金と30日間無料の対象条件を確認する</Link>}
            </div>
          )}
          {importResult && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 font-semibold">{importResult}</p>
          )}

          {products.length > 0 && (
            <div className="mt-5 divide-y divide-slate-100">
              {products.map((p) => (
                <div key={p.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 font-semibold">
                      ナレッジ {p._count.chunks}件 / {p._count.sources}ページ
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.scenarios[0] && (
                      <>
                        <Link
                          href={`/aishodan/scenarios/${p.scenarios[0].id}`}
                          className={`rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold inline-flex items-center whitespace-nowrap${tap}`}
                        >
                          シナリオを編集
                        </Link>
                        <Link
                          href="/aishodan/preview"
                          className={`rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold inline-flex items-center whitespace-nowrap${tap}`}
                        >
                          練習する
                        </Link>
                      </>
                    )}
                    {/* ⚠️ 道連れが大きいので、他の操作と見た目を分ける（赤・枠線） */}
                    {canDelete && (
                    <button
                      onClick={() => deleteProduct(p)}
                      disabled={deletingId === p.id}
                      className={`rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap${tap}`}
                    >
                      {deletingId === p.id ? '処理中…' : '利用を終える'}
                    </button>
                    )}
                  </div>
                  </div>
                  {/* ⚠️ 商談URLの発行が手順の終点。他の操作と同じ大きさにしない */}
                  {p.scenarios[0] && (
                    <button
                      onClick={() => issueRoom(p.scenarios[0].id)}
                      disabled={issuing}
                      className={`mt-3 w-full rounded-xl bg-[#0066ff] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-200 sm:text-lg${tap}`}
                    >
                      {issuing ? '発行中…' : '商談URLを発行する'}
                      <ShellCostBadge action="voice.minute" per="分" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {productCursor && <button type="button" onClick={() => void loadMore('products')} disabled={loadingMore !== null} className={`mt-4 rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50${tap}`}>{loadingMore === 'products' ? '読み込み中…' : `商材をさらに表示（${products.length}/${productTotal}件）`}</button>}
        </section>

        {/* 2. 商談ルーム */}
        {rooms.length > 0 && (
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <h2 className="text-base font-bold text-slate-900">2. 商談URL</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              このURLをメール・LP・広告のリンク先に置くと、相手がログイン不要で商談を始められます。
            </p>
            <div className="mt-4 space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{room.name}</p>
                      <p className="text-xs text-slate-500 font-semibold">
                        {/* ⚠️ 同じ商材から発行すると名前が全く同じになる。
                             発行日を出さないと、どれがどれだか見分けられない */}
                        {new Date(room.createdAt).toLocaleString('ja-JP', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        発行 / 実施 {room._count.sessions}件
                        {room.expiresAt && ` / ${new Date(room.expiresAt).toLocaleDateString('ja-JP')}まで`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        room.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {room.isActive ? '公開中' : '停止中'}
                    </span>
                  </div>
                  {/* ⚠️ ここが最後の操作。コピーして送れば完了だと分かるように大きく出す */}
                  <div className="mt-3 rounded-xl bg-[#eaf3ff] p-4 ring-2 ring-[#0066ff]">
                    <p className="text-base font-black text-[#0066ff] [text-wrap:balance]">
                      このURLをコピーして、相手にお送りください
                    </p>
                    <p className="mt-2 break-all rounded-lg bg-white px-3 py-3 text-sm font-bold text-[#0a0f3c] ring-1 ring-[#d8e7ff]">
                      {roomUrl(room.token)}
                    </p>
                    <button
                      onClick={() => copyUrl(room.token)}
                      className={`mt-3 w-full rounded-xl bg-[#0066ff] px-6 py-3.5 text-base font-black text-white shadow-lg transition hover:bg-[#0052cc]${tap}`}
                      aria-live="polite"
                    >
                      {copied === room.token ? 'コピーしました' : 'URLをコピーする'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={roomUrl(room.token)}
                      target="_blank"
                      rel="noopener"
                      className={`rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold inline-flex items-center whitespace-nowrap${tap}`}
                    >
                      試す
                    </a>
                    <button
                      onClick={() => toggleRoom(room)}
                      className={`rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold whitespace-nowrap${tap}`}
                    >
                      {room.isActive ? '公開を停止' : '公開する'}
                    </button>
                    {/* ⚠️ 配布済みURLが死ぬ操作。他と見た目を分ける（赤・枠線） */}
                    {canDelete && (
                    <button
                      onClick={() => deleteRoom(room)}
                      disabled={deletingId === room.id}
                      className={`ml-auto rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap${tap}`}
                    >
                      {deletingId === room.id ? '削除中…' : 'このURLを削除'}
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {roomCursor && <button type="button" onClick={() => void loadMore('rooms')} disabled={loadingMore !== null} className={`mt-4 rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50${tap}`}>{loadingMore === 'rooms' ? '読み込み中…' : `商談URLをさらに表示（${rooms.length}/${roomTotal}件）`}</button>}
          </section>
        )}

        {/* 3. 直近の商談 */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">直近の商談</h2>
            <Link href="/aishodan/sessions" className={`text-xs text-[#0066ff] hover:underline font-semibold inline-flex items-center whitespace-nowrap rounded-lg px-2${tap}`}>
              すべて見る
            </Link>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              title="まだ商談はありません"
              description={products.length === 0
                ? '商材を取り込んで商談URLを発行すると、相手との商談の記録がここに並びます。'
                : '発行した商談URLを相手に送ると、商談の記録と適合度の判定がここに並びます。先に練習モードで流れを確かめられます。'}
              art="/aishodan/empty-sessions.webp"
              action={products.length === 0
                ? <Button onClick={() => document.getElementById('aishodan-import-url')?.focus()} icon="Plus">商材を取り込む</Button>
                : <Button href="/aishodan/preview" variant="secondary" icon="Mic">練習モードで試す</Button>}
            />
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {sessions.slice(0, 8).map((s) => (
                <Link key={s.id} href={`/aishodan/sessions/${s.id}`} className={`flex items-center justify-between gap-3 py-3 hover:bg-slate-50 rounded-lg px-1${tap}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {s.guestCompany || '会社名未取得'} {s.guestName ? `／ ${s.guestName}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {new Date(s.createdAt).toLocaleString('ja-JP')} / {s._count.turns}発話
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.outcome ? (
                      <>
                        <span className="text-sm font-bold text-slate-900" title={`適合スコア ${s.outcome.fitScore} / 100`}><span className="mr-1 text-[11px] font-semibold text-slate-500">適合</span>{s.outcome.fitScore}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${VERDICT_STYLE[s.outcome.verdict]}`}>
                          {VERDICT_LABELS[s.outcome.verdict as Verdict]}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                        {SESSION_STATUS_LABELS[s.status] || s.status}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ⚠️ メンバー招待は /aishodan/settings に移した。「直近の商談」と
             「その場で答えられなかった質問」の間に挟まっていて、日々見る内容の
             真ん中で読む流れが切れていた。ここには戻さないこと。 */}

        {/* 未回答質問 = ナレッジ拡充の優先順位 */}
        {stats && stats.unanswered.length > 0 && (
          <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
            <h2 className="text-base font-bold text-slate-900">よく出た未回答の質問</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              資料に根拠が無く「確認して折り返す」と回答したものです。ここを埋めると商談の質が上がります。
            </p>
            <ul className="mt-4 space-y-2">
              {stats.unanswered.slice(0, 12).map((q) => (
                <li key={q.id} className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700 font-semibold">
                  {q.text}{q.count > 1 && <span className="ml-2 whitespace-nowrap text-xs font-bold text-blue-700">{q.count}件の商談</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}