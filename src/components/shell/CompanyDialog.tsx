'use client'
// ============================================
// 会社情報を登録する・直す小さな画面（UI 品質 B-1・B-2）
// ============================================
// 会社名とサイトの URL（業種は任意）。各ツールの組織の名前を候補として出し、押すだけで会社名に入る。
// 保存したら router.refresh() で、左下・ホーム・見出しの帯の名前を読み直す。
// ⚠️ 保存するのは本人の会社だけ（/api/account/company）。各ツールの組織の名前は変えない。
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import styles from './CompanyDialog.module.css'

type Loaded = { company: { name: string; websiteUrl: string | null; industry: string | null } | null; candidates: string[] }

export default function CompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [industry, setIndustry] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    setError(null)
    setLoaded(null)
    fetch('/api/account/company', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) { setError(typeof j.error === 'string' ? j.error : '会社情報を読み込めませんでした'); setLoaded({ company: null, candidates: [] }); return }
        const data: Loaded = { company: j.company ?? null, candidates: Array.isArray(j.candidates) ? j.candidates : [] }
        setLoaded(data)
        setName(data.company?.name ?? '')
        setWebsiteUrl(data.company?.websiteUrl ?? '')
        setIndustry(data.company?.industry ?? '')
      })
      .catch(() => { if (alive) { setError('会社情報を読み込めませんでした'); setLoaded({ company: null, candidates: [] }) } })
    return () => { alive = false }
  }, [open])

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/account/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, websiteUrl, industry }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(typeof j.error === 'string' ? j.error : '保存できませんでした'); return }
      onClose()
      router.refresh()
    } catch {
      setError('保存できませんでした。通信を確かめて、もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    {/* 開いている間は、HubSpot のポップアップ（右下）を隠す。showModal の最前面の層より上に、あとから出ることがあるため */}
    {open ? <style>{'[id^="hs-web-interactives"],[class*="hs-web-interactive"],#hubspot-messages-iframe-container,.hs-overlay-container{display:none!important}'}</style> : null}
    <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      <form className={styles.body} onSubmit={(e) => { e.preventDefault(); if (!busy) void save() }}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>{loaded?.company ? '会社情報を直す' : '会社情報を登録する'}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる"><X size={18} aria-hidden /></button>
        </div>
        <p className={styles.lead}>登録した会社名は、左下・経営ホーム・各ツールの見出しに出ます。各ツールの組織の名前は変わりません。</p>

        <label className={styles.field}>
          <span className={styles.label}>会社名</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoComplete="organization" placeholder="例: 株式会社〇〇" />
        </label>
        {loaded?.candidates.length ? (
          <div className={styles.candidates}>
            <p className={styles.hint}>各ツールで使っている名前から選べます</p>
            <div className={styles.chips}>
              {loaded.candidates.map((c) => (
                <button key={c} type="button" className={styles.chip} aria-pressed={name === c} onClick={() => setName(c)}>{c}</button>
              ))}
            </div>
          </div>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>サイトの URL <span className={styles.optional}>任意</span></span>
          <input className={styles.input} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} inputMode="url" autoComplete="url" placeholder="例: https://example.co.jp" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>業種 <span className={styles.optional}>任意</span></span>
          <input className={styles.input} value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={50} placeholder="例: 広告・マーケティング" />
        </label>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>やめる</button>
          <button type="submit" className={styles.primary} disabled={busy || !loaded || !name.trim()}>{busy ? '保存しています…' : '保存する'}</button>
        </div>
      </form>
    </dialog>
    </>
  )
}
