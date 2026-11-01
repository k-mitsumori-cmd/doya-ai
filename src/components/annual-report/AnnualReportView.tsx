'use client'
// ============================================
// 年間レポート（共有できる画像）の画面
// ============================================
// 年・大きさ・画像に入れる項目を選び、サーバー（/api/annual-report/image）が作った画像を見て保存する。
// ⚠️ 顧客名・金額・社員名は、既定で入れない。選べるのは、サーバーが許した項目（allowed）だけ。
//    ここで選べても、最後に確かめるのはサーバー（許していない項目は画像に入らない）。
// ⚠️ 演出は控えめ（動きは画像の切り替えのフェードだけ）。
import { useEffect, useMemo, useRef, useState } from 'react'
import { UiIcon } from '@/components/icons'
import { IMAGE_SIZES, REVEAL_KEYS, REVEAL_LABELS, SENSITIVE_REVEAL, DEFAULT_REVEAL, type ImageSize, type RevealKey } from '@/lib/annual-report/report'
import type { DoyaPowerFx } from '@/lib/doya-power/fx'
import { DoyaPowerFxProvider, useDoyaPowerFx } from '@/components/doya-power/fx-context'
import DoyaPowerFxSettings from '@/components/doya-power/DoyaPowerFxSettings'
import styles from './AnnualReportView.module.css'

export interface AnnualReportViewProps {
  years: number[]
  initialYear: number
  /** サーバーが許した項目 */
  allowed: RevealKey[]
  /** 見本のデータで出す（開発の確認用） */
  sample?: boolean
  /** ドヤくんの表示と演出の設定（組織・個人）。省略するとすべてオン */
  fx?: DoyaPowerFx
  /** 会社の表示設定を変えられるか（会社の持ち主） */
  canEditOrgFx?: boolean
}

export function annualImageUrl(o: { year: number; size: ImageSize; show: RevealKey[]; sample?: boolean; download?: boolean; mascot?: boolean }): string {
  const p = new URLSearchParams({ year: String(o.year), size: o.size, show: o.show.join(',') })
  if (o.sample) p.set('sample', '1')
  if (o.download) p.set('download', '1')
  // ドヤくんを出さない設定のとき。台紙（ドヤくんの絵）を使わず、無地の枠で作る（render.server.ts の plain）
  if (o.mascot === false) p.set('mascot', '0')
  return `/api/annual-report/image?${p.toString()}`
}

const sampleSave = async () => ({ ok: true as const })

export default function AnnualReportView(props: AnnualReportViewProps) {
  return (
    <DoyaPowerFxProvider fx={props.fx}>
      <AnnualBody {...props} />
    </DoyaPowerFxProvider>
  )
}

function AnnualBody({ years, initialYear, allowed, sample, canEditOrgFx = false }: AnnualReportViewProps) {
  const { mascot, motion } = useDoyaPowerFx()
  const [year, setYear] = useState(initialYear)
  const [size, setSize] = useState<ImageSize>('wide')
  const [show, setShow] = useState<RevealKey[]>(() => DEFAULT_REVEAL.filter((k) => allowed.includes(k)))
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const src = useMemo(() => annualImageUrl({ year, size, show, sample, mascot }), [year, size, show, sample, mascot])
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    // ⚠️ 画像が描画（hydration）より先に読み終わると onLoad が来ない。読み終わっていれば、ここで表示に切り替える
    const img = imgRef.current
    setState(img?.complete ? (img.naturalWidth > 0 ? 'ready' : 'error') : 'loading')
  }, [src])

  const toggle = (k: RevealKey) =>
    setShow((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : REVEAL_KEYS.filter((x) => x === k || cur.includes(x))))

  const dim = IMAGE_SIZES[size]

  return (
    <div className={styles.page} data-motion={motion ? 'on' : 'off'}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>年間レポート</p>
        <h1 className={styles.title}>{year}年のドヤAI</h1>
        <p className={styles.lead}>1年分の利用を、共有できる画像にまとめます。数字は、ツールで作った記録から数えています。</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.controls} aria-label="画像の設定">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="annual-year">年</label>
            <select id="annual-year" className={styles.select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>

          <fieldset className={styles.field}>
            <legend className={styles.label}>大きさ</legend>
            <div className={styles.segment} role="radiogroup">
              {(Object.keys(IMAGE_SIZES) as ImageSize[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={size === s} className={size === s ? styles.segOn : styles.seg} onClick={() => setSize(s)}>
                  {IMAGE_SIZES[s].label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.label}>画像に入れる項目</legend>
            <p className={styles.help}>顧客名・金額・社員名は、選んだときだけ入ります。</p>
            <ul className={styles.checks}>
              {REVEAL_KEYS.map((k) => {
                const ok = allowed.includes(k)
                return (
                  <li key={k}>
                    <label className={ok ? styles.check : styles.checkOff}>
                      <input type="checkbox" checked={show.includes(k)} disabled={!ok} onChange={() => toggle(k)} />
                      <span>{REVEAL_LABELS[k]}</span>
                      {!ok && SENSITIVE_REVEAL.includes(k) ? (
                        <span className={styles.lock}>
                          <UiIcon name="lock" size={14} aria-hidden />
                          会社の管理者だけ
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>

          <a className={styles.save} href={annualImageUrl({ year, size, show, sample, download: true, mascot })} download>
            <UiIcon name="download" size={18} aria-hidden />
            画像を保存
          </a>
          <p className={styles.note}>
            時間は、1件あたりの目安の時間（バナー30分・SEO の記事3時間など）で換算しています。実際にかかった時間ではありません。
          </p>
        </section>

        <section className={styles.preview} aria-label="画像の見本">
          <div className={styles.frame} style={{ aspectRatio: `${dim.width} / ${dim.height}`, maxWidth: size === 'tall' ? 460 : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={src}
              ref={imgRef}
              src={src}
              alt={`${year}年の年間レポートの画像（${dim.label}）`}
              className={state === 'ready' ? styles.imgOn : styles.img}
              onLoad={() => setState('ready')}
              onError={() => setState('error')}
            />
            {state === 'loading' ? <p className={styles.status}>画像を作っています</p> : null}
            {state === 'error' ? <p className={styles.status}>画像を作れませんでした。時間をおいて開き直してください</p> : null}
          </div>
        </section>
      </div>

      <DoyaPowerFxSettings canEditOrg={canEditOrgFx} onSave={sample ? sampleSave : undefined} />
    </div>
  )
}
