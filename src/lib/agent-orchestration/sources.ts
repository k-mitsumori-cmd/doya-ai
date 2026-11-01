// ============================================
// 分析の材料を同時に読む（作戦づくりの前）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §3.1
// - 材料（依頼と答え・登録会社・使うツールの準備・ドヤパワーの残り）を同時に読み、読み始め・読み終わりを emit で知らせる。
// - 読み終えた順に知らせる（作り話の進み具合は出さない）。読めなかった材料は skipped にし、作戦は止めない。
// - 読み方（readers）は引数でもらう。本番は sources.server.ts、テストは差し替え。
// ⚠️ ここは純粋な部品。DB やセッションの処理は書かない。
import type { SalesPrepAnswers } from './recipes'
import type { AgentPowerView, AgentReadiness, AgentSourceView } from './types'

export interface SourceReaders {
  /** 登録会社の名前。未登録なら null */
  company: () => Promise<string | null>
  /** ツールの組織があるか（商談準備・見積もりAI は組織が要る。スライドは要らない） */
  toolOrgs: () => Promise<{ shodan: boolean; quote: boolean }>
  /** ドヤパワーの残り（旗の外・会社が未登録なら enabled: false） */
  power: () => Promise<AgentPowerView>
}

export interface SourceResult {
  sources: AgentSourceView[]
  readiness: Record<string, AgentReadiness>
  companyName: string | null
  power: AgentPowerView
}

const NO_POWER: AgentPowerView = { enabled: false, remaining: null, nextRecoveryAt: null }

const SETUP: Record<'shodan' | 'quote', AgentReadiness> = {
  shodan: { ok: false, reason: 'ドヤ商談準備の組織がまだありません。', href: '/shodan', hrefLabel: '商談準備を開く' },
  quote: { ok: false, reason: 'ドヤ見積もりAIの組織がまだありません。', href: '/quote', hrefLabel: '見積もりAIを開く' },
}

/** 材料を同時に読む。emit は札が変わるたびに呼ぶ（同じ id の札を上書きする） */
export async function readSources(a: SalesPrepAnswers, readers: SourceReaders, emit: (s: AgentSourceView) => void = () => {}): Promise<SourceResult> {
  const out: Record<string, AgentSourceView> = {}
  const put = (s: AgentSourceView) => { out[s.id] = s; emit(s) }
  const result: SourceResult = { sources: [], readiness: {}, companyName: null, power: NO_POWER }

  const jobs: { id: string; kind: AgentSourceView['kind']; label: string; read: () => Promise<{ status: 'read' | 'skipped'; note: string }> }[] = [
    {
      id: 'request', kind: 'request', label: '依頼と答え',
      read: async () => ({ status: 'read', note: `${a.domain}・${a.offerLabel}・${a.stageLabel}` }),
    },
    {
      id: 'company', kind: 'company', label: '登録会社の情報',
      read: async () => {
        const name = await readers.company()
        result.companyName = name
        return name ? { status: 'read', note: name } : { status: 'skipped', note: 'まだ登録されていません' }
      },
    },
    {
      id: 'tools', kind: 'tools', label: '使うツールの準備',
      read: async () => {
        const orgs = await readers.toolOrgs()
        const missing: string[] = []
        for (const tool of ['shodan', 'quote'] as const) {
          if (!orgs[tool]) { result.readiness[tool] = SETUP[tool]; missing.push(tool === 'shodan' ? '商談準備' : '見積もりAI') }
        }
        return { status: 'read', note: missing.length ? `${missing.join('と')}の組織がまだありません` : '3つのツールを使えます' }
      },
    },
    {
      id: 'power', kind: 'power', label: 'ドヤパワーの残り',
      read: async () => {
        const p = await readers.power()
        result.power = p
        return p.enabled && p.remaining !== null ? { status: 'read', note: `残り ${p.remaining.toLocaleString('ja-JP')}` } : { status: 'skipped', note: 'ドヤパワーを使わない設定です' }
      },
    },
  ]

  for (const j of jobs) put({ id: j.id, kind: j.kind, label: j.label, status: 'reading' })
  await Promise.all(jobs.map(async (j) => {
    let r: { status: 'read' | 'skipped'; note: string }
    try { r = await j.read() } catch { r = { status: 'skipped', note: '読めませんでした' } }
    put({ id: j.id, kind: j.kind, label: j.label, ...r })
  }))
  result.sources = jobs.map((j) => out[j.id])
  return result
}
