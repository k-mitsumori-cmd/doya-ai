'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { INDUSTRIES, AREAS } from '@/lib/doyalist/constants'

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

function getPlanTier(usage: Usage | null): string {
  if (!usage?.plan) return 'FREE'
  if (typeof usage.plan === 'string') return usage.plan.toUpperCase()
  return String(usage.plan.tier || usage.plan.raw || 'FREE').toUpperCase()
}

function planLabel(tier: string): string {
  if (tier === 'ENTERPRISE') return 'エンタープライズ'
  if (tier === 'PRO' || tier === 'LIGHT') return 'プロ'
  return '無料'
}

const CHARS = {
  point: '/kintai/characters/point_解説.png',
  working: '/kintai/characters/working_作業中.png',
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [usage, setUsage] = useState(null as Usage | null)
  const [exporting, setExporting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
    } catch { /* ignore */ }
    fetch('/api/doyalist/usage')
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {})
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
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
        <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin" />
      </div>
    )
  }

  const tier = getPlanTier(usage)
  const planName = planLabel(tier)
  const companiesUsed = usage?.usage?.companiesGenerated ?? 0
  const companiesMax = usage?.limits?.maxCompaniesPerMonth ?? 0
  const approachesUsed = usage?.usage?.approachesGenerated ?? 0
  const approachesMax = usage?.limits?.maxApproachesPerMonth ?? 0
  const userName = session?.user?.name || 'ゲスト'
  const userEmail = session?.user?.email || ''
  const userImage = session?.user?.image || ''

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        {/* ===== Page Header ===== */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md text-2xl">⚙️</div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">設定</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">アカウント情報・プラン・各種設定を管理します</p>
          </div>
        </div>

        {/* ===== 3-Column Layout ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== Col 1: Account ===== */}
          <Card icon="account_circle" title="アカウント" subtitle="ログイン情報">
            <div className="flex flex-col items-center pb-5 border-b border-slate-100">
              {userImage ? (
                <img src={userImage} alt={userName} className="w-20 h-20 rounded-full object-cover ring-4 ring-cyan-100 shadow" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center text-white text-3xl font-black shadow">
                  {userName[0]}
                </div>
              )}
              <p className="mt-3 text-base font-black text-[#0a1530]">{userName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{userEmail}</p>
            </div>

            <div className="space-y-3 pt-4">
              <InfoRow label="ログイン方法" value="Google" icon="login" />
              <InfoRow label="言語" value="日本語" icon="language" />
              <InfoRow label="タイムゾーン" value="Asia/Tokyo (JST)" icon="schedule" />
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/doyalist' })}
              className="mt-5 w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              ログアウト
            </button>
          </Card>

          {/* ===== Col 2: Plan & Usage ===== */}
          <Card icon="diamond" title="プラン" subtitle="ご契約状況">
            <div className="text-center pb-5 border-b border-slate-100">
              <span className={`inline-block text-xs font-black px-3 py-1 rounded-full mb-2 ${
                tier === 'PRO' || tier === 'LIGHT' ? 'bg-cyan-100 text-cyan-700'
                : tier === 'ENTERPRISE' ? 'bg-violet-100 text-violet-700'
                : 'bg-slate-100 text-slate-600'
              }`}>
                現在のプラン
              </span>
              <p className="text-3xl font-black text-[#0a1530]">{planName}</p>
              {usage?.plan && typeof usage.plan === 'object' && usage.plan.periodEnd && tier !== 'FREE' && (
                <p className="text-[10px] text-slate-400 mt-1">
                  次回更新: {new Date(usage.plan.periodEnd).toLocaleDateString('ja-JP')}
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4">
              <UsageBar
                label="今月の抽出社数"
                used={companiesUsed}
                max={companiesMax}
                color="cyan"
              />
              <UsageBar
                label="今月のツール生成"
                used={approachesUsed}
                max={approachesMax}
                color="violet"
              />
            </div>

            <Link
              href="/doyalist/pricing"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-base">arrow_upward</span>
              プランをアップグレード
            </Link>
          </Card>

          {/* ===== Col 3: Preferences ===== */}
          <Card icon="tune" title="設定" subtitle="表示・通知・データ">
            {/* 表示密度 */}
            <SettingRow label="表示密度" help="一覧表示の余白">
              <div className="flex gap-1.5">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => update('density', d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      settings.density === d
                        ? 'bg-[#0a1530] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d === 'comfortable' ? '標準' : 'コンパクト'}
                  </button>
                ))}
              </div>
            </SettingRow>

            {/* メール通知 */}
            <SettingRow label="メール通知" help="重要イベント時にメール">
              <ToggleSwitch
                checked={settings.emailNotifications}
                onChange={(v) => update('emailNotifications', v)}
              />
            </SettingRow>

            {/* デフォルト業界 */}
            <SettingRow label="既定の業界" help="新規抽出時の初期値">
              <select
                value={settings.defaultIndustry}
                onChange={(e) => update('defaultIndustry', e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-cyan-500"
              >
                <option value="">未設定</option>
                {INDUSTRIES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </SettingRow>

            {/* デフォルトエリア */}
            <SettingRow label="既定のエリア" help="新規抽出時の初期値">
              <select
                value={settings.defaultRegion}
                onChange={(e) => update('defaultRegion', e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-cyan-500"
              >
                <option value="">未設定</option>
                {AREAS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </SettingRow>

            {/* データエクスポート */}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <p className="text-xs font-black text-[#0a1530] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-cyan-600">cloud_download</span>
                データ管理
              </p>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                すべてのプロジェクトの企業データをCSVで一括ダウンロードできます
              </p>
              <button
                onClick={handleExportAll}
                disabled={exporting}
                className="w-full py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <img src={CHARS.working} alt="" className="w-4 h-4 animate-spin" />
                    エクスポート中...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">download</span>
                    全件エクスポート（CSV）
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>

        {/* ===== Support Section（強調版） ===== */}
        <div className="mt-8 p-6 bg-gradient-to-br from-cyan-50 via-white to-violet-50 rounded-3xl border-2 border-cyan-200 shadow-lg">
          <div className="flex items-center gap-4 flex-wrap">
            <img src={CHARS.point} alt="" className="w-16 h-16 flex-shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-base font-black text-[#0a1530] flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-600">support_agent</span>
                サポート窓口
              </p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                ご質問・不具合報告・ご要望はお気軽にご連絡ください
              </p>
            </div>
            <a
              href="mailto:support@surisuta.jp?subject=ドヤリストに関するお問い合わせ"
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-black text-sm rounded-xl shadow-lg shadow-cyan-500/30 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">mail</span>
              support@surisuta.jp
            </a>
          </div>
          <div className="mt-4 pt-4 border-t border-cyan-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="material-symbols-outlined text-cyan-500 text-base">schedule</span>
              <span>平日 10:00-18:00 (JST)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="material-symbols-outlined text-cyan-500 text-base">reply</span>
              <span>通常 1営業日以内に返信</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="material-symbols-outlined text-cyan-500 text-base">language</span>
              <span>日本語のみ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
        <span className="material-symbols-outlined text-cyan-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <div>
          <h2 className="text-base font-black text-[#0a1530]">{title}</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function SettingRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-[#0a1530]">{label}</p>
        {help && <p className="text-[10px] text-slate-400 mt-0.5">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-slate-500">
        <span className="material-symbols-outlined text-base">{icon}</span>
        {label}
      </span>
      <span className="font-bold text-[#0a1530]">{value}</span>
    </div>
  )
}

function UsageBar({ label, used, max, color }: { label: string; used: number; max: number; color: 'cyan' | 'violet' }) {
  const isUnlimited = max === -1
  const pct = isUnlimited ? 0 : max > 0 ? Math.min(100, (used / max) * 100) : 0
  // 80%以上で警告色、95%以上で危険色
  const warningLevel = pct >= 95 ? 'danger' : pct >= 80 ? 'warn' : 'normal'
  const colorMap = {
    cyan: { bar: 'bg-gradient-to-r from-cyan-400 to-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-700' },
    violet: { bar: 'bg-gradient-to-r from-violet-400 to-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
  }
  const c = colorMap[color]
  const barColor = warningLevel === 'danger' ? 'bg-gradient-to-r from-rose-400 to-rose-500'
    : warningLevel === 'warn' ? 'bg-gradient-to-r from-amber-400 to-amber-500'
    : c.bar
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-slate-600">{label}</p>
        <p className="text-xs font-black text-[#0a1530]">
          {used.toLocaleString()}<span className="text-slate-400 font-medium"> / {isUnlimited ? '∞' : max.toLocaleString()}</span>
        </p>
      </div>
      <div className={`relative h-3 rounded-full ${c.bg} overflow-hidden`}>
        {!isUnlimited && (
          <>
            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
            {pct > 15 && (
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[9px] font-black text-white drop-shadow">
                {pct.toFixed(0)}%
              </span>
            )}
          </>
        )}
        {isUnlimited && (
          <>
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: '100%' }} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
              無制限
            </span>
          </>
        )}
      </div>
      {warningLevel === 'danger' && (
        <p className="text-[10px] text-rose-600 mt-1 font-bold">⚠️ まもなく上限です。プランをアップグレードしてください</p>
      )}
      {warningLevel === 'warn' && (
        <p className="text-[10px] text-amber-600 mt-1 font-bold">⏰ あと {(max - used).toLocaleString()} で上限です</p>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-slate-300'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
