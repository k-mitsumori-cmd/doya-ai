'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { INDUSTRIES, AREAS } from '@/lib/doyalist/constants'

const INDUSTRY_OPTIONS = INDUSTRIES
const REGION_OPTIONS = AREAS

const SETTINGS_KEY = 'doyalist:settings'

interface Settings {
  density: 'comfortable' | 'compact'
  defaultIndustry: string
  defaultRegion: string
  emailNotifications: boolean
}

const DEFAULT_SETTINGS: Settings = {
  density: 'comfortable',
  defaultIndustry: '',
  defaultRegion: '',
  emailNotifications: true,
}

interface Usage {
  plan?: { raw?: string; tier?: string; periodEnd?: string | null } | string
  limits?: {
    maxProjects?: number
    maxCompaniesPerMonth?: number
    maxApproachesPerMonth?: number
  }
  usage?: {
    monthStart?: string
    activeProjects?: number
    companiesGenerated?: number
    approachesGenerated?: number
  }
  remaining?: {
    projects?: number
    companies?: number
    approaches?: number
  }
}

// プラン表示の正規化
function getPlanTier(usage: Usage | null): string {
  if (!usage?.plan) return 'FREE'
  if (typeof usage.plan === 'string') return usage.plan.toUpperCase()
  return String(usage.plan.tier || usage.plan.raw || 'FREE').toUpperCase()
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [usage, setUsage] = useState(null as Usage | null)
  const [exporting, setExporting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
    } catch {
      /* ignore */
    }
    fetch('/api/doyalist/usage')
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {})
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    toast.success('設定を保存しました', { duration: 1500 })
  }

  const handleExportAll = async () => {
    setExporting(true)
    const tid = toast.loading('全プロジェクトをエクスポート中...')
    try {
      const res = await fetch('/api/doyalist/projects')
      const data = await res.json()
      const projects: any[] = Array.isArray(data) ? data : data?.projects || []
      if (projects.length === 0) {
        toast.error('エクスポートするプロジェクトがありません', { id: tid })
        return
      }
      // Download CSVs in series
      for (const p of projects) {
        const url = `/api/doyalist/export?projectId=${p.id}&format=csv`
        const a = document.createElement('a')
        a.href = url
        a.download = `${p.name || p.id}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        await new Promise((r) => setTimeout(r, 300))
      }
      toast.success(`${projects.length}件のCSVをダウンロードしました`, { id: tid })
    } catch (e: any) {
      toast.error(e?.message || 'エクスポートに失敗しました', { id: tid })
    } finally {
      setExporting(false)
    }
  }

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-black text-slate-800">設定</h1>
        <p className="text-sm text-slate-500 mt-1">表示・通知・データ管理</p>
      </div>

      {/* 表示設定 */}
      <Section icon="palette" title="表示設定">
        <SettingRow label="情報密度" help="一覧表示の余白を調整します">
          <div className="flex gap-1.5">
            {(['comfortable', 'compact'] as const).map((d) => (
              <button
                key={d}
                onClick={() => update('density', d)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  settings.density === d
                    ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d === 'comfortable' ? '標準' : 'コンパクト'}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow label="メール通知" help="重要なイベント発生時にメール通知します">
          <ToggleSwitch
            checked={settings.emailNotifications}
            onChange={(v) => update('emailNotifications', v)}
          />
        </SettingRow>
      </Section>

      {/* デフォルト値 */}
      <Section icon="tune" title="新規プロジェクトのデフォルト">
        <SettingRow label="デフォルト業界">
          <select
            value={settings.defaultIndustry}
            onChange={(e) => update('defaultIndustry', e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6]"
          >
            <option value="">未設定</option>
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="デフォルト地域">
          <select
            value={settings.defaultRegion}
            onChange={(e) => update('defaultRegion', e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6]"
          >
            <option value="">未設定</option>
            {REGION_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      {/* データエクスポート */}
      <Section icon="cloud_download" title="データエクスポート">
        <p className="text-sm text-slate-500 mb-4">
          すべてのプロジェクトの企業データをCSV形式で一括ダウンロードできます
        </p>
        <button
          onClick={handleExportAll}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
        >
          {exporting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              エクスポート中...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">download</span>
              全件エクスポート（CSV）
            </>
          )}
        </button>
      </Section>

      {/* 利用統計 */}
      <Section icon="analytics" title="利用統計">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBlock
            label="現在のプラン"
            value={getPlanTier(usage)}
            icon="diamond"
          />
          <StatBlock
            label="今月の抽出社数"
            value={String(usage?.usage?.companiesGenerated ?? 0)}
            icon="apartment"
          />
          <StatBlock
            label="今月のツール利用"
            value={String(usage?.usage?.approachesGenerated ?? 0)}
            icon="edit_note"
          />
          <StatBlock
            label="今月の上限（社数）"
            value={
              usage?.limits?.maxCompaniesPerMonth === -1
                ? '無制限'
                : (usage?.limits?.maxCompaniesPerMonth ?? 0).toLocaleString()
            }
            icon="speed"
          />
        </div>
        <Link
          href="/doyalist/pricing"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#7f19e6] hover:underline mt-4"
        >
          <span className="material-symbols-outlined text-base">arrow_forward</span>
          プランをアップグレード
        </Link>
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#7f19e6]">{icon}</span>
        <h2 className="text-base font-black text-slate-800">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-slate-700">{label}</p>
        {help && <p className="text-xs text-slate-400 mt-0.5">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-[#7f19e6]' : 'bg-slate-300'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[1.625rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function StatBlock({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="material-symbols-outlined text-[#7f19e6] text-base">{icon}</span>
        <p className="text-[10px] font-bold text-slate-500">{label}</p>
      </div>
      <p className="text-lg font-black text-slate-800">{value}</p>
    </div>
  )
}
