'use client'

// ドヤバナーAI 最初の工程：見本を眺めて、好きな雰囲気を最大3枚選ぶ
// 絞り込み（テイスト／業種／用途）・検索・並び替え・拡大プレビュー・お気に入り・選択トレイ
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Expand, Heart, Plus, Search, Sparkles, X } from 'lucide-react'
import s from './renewal.module.css'
import { GALLERY, GALLERY_GROUPS, type GalleryGroup, type GalleryItem } from './data'

export const MAX_REFS = 3
type Sort = 'popular' | 'new'

export function BannerGallery({
  selected,
  onChange,
  onNext,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  onNext: () => void
}) {
  const [group, setGroup] = useState<GalleryGroup | 'all'>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('popular')
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [onlyLiked, setOnlyLiked] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [shake, setShake] = useState(false)

  const tags = useMemo(
    () => (group === 'all' ? [] : Array.from(new Set(GALLERY.filter((g) => g.group === group).map((g) => g.tag)))),
    [group],
  )
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = GALLERY.filter(
      (g) =>
        (group === 'all' || g.group === group) &&
        (!tag || g.tag === tag) &&
        (!onlyLiked || liked.has(g.id)) &&
        (!needle || `${g.title}${g.tag}`.toLowerCase().includes(needle)),
    )
    return sort === 'popular' ? [...list].sort((a, b) => b.uses - a.uses) : [...list].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew))
  }, [group, tag, q, sort, liked, onlyLiked])

  const toggle = (id: string) => {
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id))
    if (selected.length >= MAX_REFS) {
      // 上限のときはトレイを揺らして知らせる
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    onChange([...selected, id])
  }
  const toggleLike = (id: string) => {
    const next = new Set(liked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setLiked(next)
  }

  // 拡大プレビューは矢印キーで送れる
  useEffect(() => {
    if (preview === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPreview((p) => (p === null ? p : (p + 1) % items.length))
      if (e.key === 'ArrowLeft') setPreview((p) => (p === null ? p : (p - 1 + items.length) % items.length))
      if (e.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, items.length])

  const byId = (id: string) => GALLERY.find((g) => g.id === id)!
  const filterKey = `${group}-${tag}-${q}-${sort}-${onlyLiked}`

  return (
    <div className={s.gallery}>
      <div className={s.galleryHead}>
        <div>
          <p className={s.galleryKicker}>STEP 1</p>
          <h2 className={s.galleryTitle}>まずは、好きな見本を選んでください</h2>
          <p className={s.cardNote}>最大{MAX_REFS}枚まで。選んだ雰囲気に寄せて、新しいバナーを作ります。</p>
        </div>
        <div className={s.galleryTools}>
          <span className={s.gallerySearch}>
            <Search size={15} strokeWidth={2} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：やわらか、飲食、SNS" aria-label="見本を探す" />
          </span>
          <div className={s.segment} role="group" aria-label="並び順">
            <button type="button" aria-pressed={sort === 'popular'} onClick={() => setSort('popular')}>
              よく使われる順
            </button>
            <button type="button" aria-pressed={sort === 'new'} onClick={() => setSort('new')}>
              新着順
            </button>
          </div>
        </div>
      </div>

      <div className={s.galleryTabs} role="tablist" aria-label="見本の分け方">
        {[{ id: 'all' as const, label: 'すべて' }, ...GALLERY_GROUPS].map((g) => {
          const on = group === g.id && !onlyLiked
          const count = g.id === 'all' ? GALLERY.length : GALLERY.filter((x) => x.group === g.id).length
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setGroup(g.id)
                setTag(null)
                setOnlyLiked(false)
              }}
            >
              {on && <motion.span layoutId="rn-gallery-tab" className={s.galleryTabPill} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              {g.label}
              <small>{count}</small>
            </button>
          )
        })}
        <button type="button" role="tab" aria-selected={onlyLiked} onClick={() => setOnlyLiked(!onlyLiked)} className={s.galleryLikedTab}>
          {onlyLiked && <motion.span layoutId="rn-gallery-tab" className={s.galleryTabPill} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <Heart size={13} strokeWidth={2.2} />
          お気に入り
          <small>{liked.size}</small>
        </button>
      </div>

      {tags.length > 0 && (
        <div className={s.galleryTags}>
          <button type="button" className={`${s.chip} ${!tag ? s.chipOn : ''}`} onClick={() => setTag(null)}>
            ぜんぶ
          </button>
          {tags.map((t) => (
            <button key={t} type="button" className={`${s.chip} ${tag === t ? s.chipOn : ''}`} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      <p className={s.galleryCount}>
        <b>{items.length}</b>件の見本
      </p>

      <div key={filterKey} className={s.galleryGrid}>
        {items.map((it, i) => {
          const order = selected.indexOf(it.id)
          return (
            <GalleryCard
              key={it.id}
              item={it}
              index={i}
              big={i % 7 === 0 && !q && !tag}
              order={order}
              liked={liked.has(it.id)}
              onToggle={() => toggle(it.id)}
              onLike={() => toggleLike(it.id)}
              onPreview={() => setPreview(i)}
            />
          )
        })}
        {items.length === 0 && <p className={s.galleryEmpty}>合う見本がありませんでした。条件をゆるめてみてください。</p>}
      </div>

      {/* 選択トレイ：下に張り付き、選んだ順に並ぶ */}
      <div className={`${s.tray} ${selected.length ? s.trayOn : ''} ${shake ? s.trayShake : ''}`}>
        <div className={s.traySlots}>
          {Array.from({ length: MAX_REFS }, (_, i) => {
            const id = selected[i]
            const it = id ? byId(id) : null
            return (
              <span key={i} className={s.traySlot} data-filled={it ? '' : undefined}>
                {it ? (
                  <>
                    <img key={it.id} src={it.src} alt={it.title} />
                    <button type="button" onClick={() => toggle(it.id)} aria-label={`${it.title}を外す`} data-cursor="外す">
                      <X size={12} strokeWidth={3} />
                    </button>
                    <i>{i + 1}</i>
                  </>
                ) : (
                  <Plus size={16} strokeWidth={2} />
                )}
              </span>
            )
          })}
        </div>
        <p className={s.trayText}>
          {selected.length === 0 ? '見本をクリックして選ぶ' : `${selected.length}/${MAX_REFS}枚 選択中`}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])}>
              選び直す
            </button>
          )}
        </p>
        <button type="button" className={s.btnPrimary} disabled={selected.length === 0} onClick={onNext} data-magnetic data-cursor="次へ">
          <span>この雰囲気で作る</span>
          <span className={s.arw}>
            <ArrowRight size={15} strokeWidth={2} />
          </span>
        </button>
      </div>

      {preview !== null && items[preview] && (
        <Lightbox
          items={items}
          index={preview}
          selected={selected}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
          onToggle={toggle}
        />
      )}
    </div>
  )
}

function GalleryCard({
  item,
  index,
  big,
  order,
  liked,
  onToggle,
  onLike,
  onPreview,
}: {
  item: GalleryItem
  index: number
  big: boolean
  order: number
  liked: boolean
  onToggle: () => void
  onLike: () => void
  onPreview: () => void
}) {
  const on = order >= 0
  return (
    <figure
      className={`${s.gCard} ${on ? s.gCardOn : ''}`}
      data-big={big ? '' : undefined}
      style={{ '--i': Math.min(index, 18) } as CSSProperties}
      data-spot
    >
      <button type="button" className={s.gHit} onClick={onToggle} aria-pressed={on} aria-label={`${item.title}を${on ? '外す' : '選ぶ'}`} data-cursor={on ? '外す' : '選ぶ'}>
        <span className={s.gImg}>
          <img src={item.src} alt="" loading="lazy" />
        </span>
      </button>
      <figcaption className={s.gCap}>
        <span className={s.gTag}>{item.tag}</span>
        <strong>{item.title}</strong>
        <small>{item.uses.toLocaleString()}回 使用</small>
      </figcaption>
      {item.isNew && <span className={s.gNew}>NEW</span>}
      {on && (
        <span className={s.gOrder} key={order}>
          {order + 1}
        </span>
      )}
      <div className={s.gActions}>
        <button type="button" onClick={onLike} aria-pressed={liked} aria-label="お気に入り" data-cursor={liked ? '外す' : 'お気に入り'} className={liked ? s.gLiked : ''}>
          <Heart size={15} strokeWidth={2.2} />
        </button>
        <button type="button" onClick={onPreview} aria-label="拡大して見る" data-cursor="拡大">
          <Expand size={15} strokeWidth={2.2} />
        </button>
      </div>
    </figure>
  )
}

function Lightbox({
  items,
  index,
  selected,
  onIndex,
  onClose,
  onToggle,
}: {
  items: GalleryItem[]
  index: number
  selected: string[]
  onIndex: (i: number) => void
  onClose: () => void
  onToggle: (id: string) => void
}) {
  const it = items[index]
  const on = selected.includes(it.id)
  const similar = items.filter((x) => x.id !== it.id && (x.tag === it.tag || x.group === it.group)).slice(0, 5)
  return (
    <div className={s.lbScrim} onClick={onClose}>
      <div className={s.lb} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${it.title}の拡大`}>
        <button type="button" className={s.lbClose} onClick={onClose} aria-label="閉じる">
          <X size={18} />
        </button>
        <div className={s.lbStage}>
          <button type="button" className={s.lbNav} data-side="prev" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="前の見本">
            <ChevronLeft size={22} />
          </button>
          <img key={it.id} src={it.src} alt={it.title} className={s.lbImg} />
          <button type="button" className={s.lbNav} data-side="next" onClick={() => onIndex((index + 1) % items.length)} aria-label="次の見本">
            <ChevronRight size={22} />
          </button>
        </div>
        <div className={s.lbInfo}>
          <div>
            <span className={s.gTag}>{it.tag}</span>
            <p className={s.lbTitle}>{it.title}</p>
            <p className={s.cardNote}>
              {index + 1} / {items.length}・{it.uses.toLocaleString()}回 使用・← → で送れます
            </p>
          </div>
          <button type="button" className={s.btnPrimary} onClick={() => onToggle(it.id)} data-magnetic>
            <span>{on ? 'この見本を外す' : 'この見本を選ぶ'}</span>
            <span className={s.arw}>{on ? <X size={15} /> : <Sparkles size={15} />}</span>
          </button>
        </div>
        {similar.length > 0 && (
          <div className={s.lbSimilar}>
            <p>似ている見本</p>
            <div>
              {similar.map((x) => (
                <button key={x.id} type="button" onClick={() => onIndex(items.indexOf(x))} data-cursor="見る">
                  <img src={x.src} alt={x.title} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
