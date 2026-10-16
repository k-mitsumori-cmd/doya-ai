'use client'

// ツール画面の型（文章系）: テーマ → 構成が組み上がる → 本文が埋まる → 採点を見ながら仕上げる
// 見本のため生成APIは呼ばない。処理はタイマーで再現する。
import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, CircleDashed, FileText, Search, Sparkles, Users } from 'lucide-react'
import s from './renewal.module.css'
import { Ring } from './motion'
import { ToolHeader, Stepper } from './ToolChrome'

type Phase = 'input' | 'outline' | 'write' | 'review'
const STEP_OF: Record<Phase, number> = { input: 0, outline: 1, write: 2, review: 3 }
const STEPS = ['テーマを決める', '構成をつくる', '本文を書く', '仕上げる']

const OUTLINE = [
  { h2: '結論：カフェの集客は「地図・SNS・常連」の3本で足りる', h3: [] },
  { h2: 'Googleマップで見つけてもらう', h3: ['写真は「外観・席・看板メニュー」の3枚から', '口コミへの返信は48時間以内に'] },
  { h2: 'Instagramは「季節」で投稿を組む', h3: ['月4本の型', 'リールは15秒で十分'] },
  { h2: '常連さんを増やす小さな仕組み', h3: ['スタンプカードをLINEに移す'] },
  { h2: 'よくある質問', h3: [] },
]

const BODY = [
  '個人経営のカフェの集客は、Googleマップ・Instagram・常連づくりの3つに絞ると、手が回る範囲で成果が出ます。',
  '最初の1か月はマップの写真と口コミ返信だけに集中し、2か月目からSNSの投稿を季節の型で回します。',
]

const CHECKS = [
  { label: '冒頭で結論を言い切っている', ok: true },
  { label: '検索キーワードが見出しに入っている', ok: true },
  { label: 'AIに引用されやすいQ&Aがある', ok: true },
  { label: '数字の出典が書かれている', ok: false },
]

const KEYWORDS = [
  { word: 'カフェ 集客', cover: 0.92 },
  { word: 'Googleマップ', cover: 0.84 },
  { word: 'Instagram 投稿', cover: 0.71 },
  { word: '常連', cover: 0.58 },
]

export function ArticleTool() {
  const [phase, setPhase] = useState<Phase>('input')
  const [keyword, setKeyword] = useState('カフェ 集客 方法')
  const [reader, setReader] = useState('個人経営のカフェのオーナー')
  const [length, setLength] = useState(6000)

  useEffect(() => {
    if (phase === 'outline') {
      const id = setTimeout(() => setPhase('write'), 3200)
      return () => clearTimeout(id)
    }
    if (phase === 'write') {
      const id = setTimeout(() => setPhase('review'), 3600)
      return () => clearTimeout(id)
    }
  }, [phase])

  return (
    <div className={s.tool}>
      <ToolHeader serviceId="seo" stageLabel="集める" note="見本の画面です。生成は行いません" />
      <Stepper steps={STEPS} current={STEP_OF[phase]} />

      {phase === 'input' ? (
        <div className={s.toolBody}>
          <form
            className={s.toolInput}
            onSubmit={(e) => {
              e.preventDefault()
              setPhase('outline')
            }}
          >
            <div className={s.field}>
              <p className={s.fieldLabel}>狙う検索キーワード</p>
              <span className={s.urlBox}>
                <Search size={16} strokeWidth={1.75} />
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="キーワード" />
              </span>
            </div>
            <div className={s.field}>
              <p className={s.fieldLabel}>誰に読ませるか</p>
              <span className={s.urlBox}>
                <Users size={16} strokeWidth={1.75} />
                <input value={reader} onChange={(e) => setReader(e.target.value)} aria-label="読者" />
              </span>
            </div>
            <div className={s.field}>
              <p className={s.fieldLabel}>
                文字数<small>{length.toLocaleString()}字前後</small>
              </p>
              <input
                type="range"
                min={3000}
                max={12000}
                step={1000}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className={s.range}
                style={{ '--v': (length - 3000) / 9000 } as CSSProperties}
                aria-label="文字数"
              />
              <div className={s.rangeScale}>
                <span>3,000</span>
                <span>12,000</span>
              </div>
            </div>
            <button type="submit" className={s.btnPrimary} data-magnetic>
              <span>構成をつくる</span>
              <span className={s.arw}>
                <Sparkles size={15} strokeWidth={2} />
              </span>
            </button>
          </form>
          <section className={s.toolCanvas}>
            <div className={s.idle}>
              <img src="/ui-renewal/mascots/seo.webp" alt="" className={s.idleImg} />
              <p className={s.idleTitle}>検索上位10記事を読み比べてから、構成を組み立てます</p>
              <ol className={s.idleSteps}>
                {['上位記事を読む', '見出しを組む', '本文を書く', 'AI検索向けに整える'].map((t, i) => (
                  <li key={t} style={{ '--i': i } as CSSProperties}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      ) : (
        <div className={s.editor}>
          <nav className={s.outline} aria-label="構成">
            <p className={s.outlineHead}>
              <FileText size={14} strokeWidth={2} /> 構成
            </p>
            <ol>
              {OUTLINE.map((o, i) => {
                const state = phase === 'outline' ? 'wait' : phase === 'write' ? (i === 0 ? 'now' : i < 2 ? 'done' : 'wait') : 'done'
                return (
                  <li key={o.h2} style={{ '--i': i } as CSSProperties} className={s.outlineItem}>
                    <span className={s.outlineH2} data-state={state}>
                      {state === 'done' ? <Check size={12} strokeWidth={3} /> : <CircleDashed size={12} strokeWidth={2} />}
                      {o.h2}
                    </span>
                    {o.h3.map((h, j) => (
                      <span key={h} className={s.outlineH3} style={{ '--j': j } as CSSProperties}>
                        {h}
                      </span>
                    ))}
                  </li>
                )
              })}
            </ol>
          </nav>

          <article className={s.paper}>
            <p className={s.paperKicker}>{keyword}</p>
            <h2 className={s.paperTitle}>カフェの集客方法｜個人店が最初の3か月でやることを順番に</h2>
            {phase === 'outline' ? (
              <div className={s.paperSkeleton}>
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} style={{ '--i': i, width: `${92 - (i % 3) * 14}%` } as CSSProperties} />
                ))}
                <p className={s.paperWait}>上位記事を読み比べて、見出しを組んでいます</p>
              </div>
            ) : (
              <>
                <div className={s.conclusion}>
                  <span>結論</span>
                  <p className={phase === 'write' ? s.typing : ''}>{BODY[0]}</p>
                </div>
                <h3 className={s.paperH2}>{OUTLINE[1].h2}</h3>
                <p className={`${s.paperP} ${phase === 'write' ? s.typing2 : ''}`}>{BODY[1]}</p>
                {phase === 'write' ? (
                  <div className={s.paperSkeleton}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ '--i': i, width: `${90 - i * 12}%` } as CSSProperties} />
                    ))}
                  </div>
                ) : (
                  <>
                    <h3 className={s.paperH2}>{OUTLINE[2].h2}</h3>
                    <p className={s.paperP}>
                      投稿は「季節の新メニュー」「席と光」「仕込みの裏側」「お客さまの声」の4本を月の型にします。迷う時間が減り、続けやすくなります。
                    </p>
                  </>
                )}
              </>
            )}
          </article>

          <aside className={s.assist}>
            <div className={s.assistScore}>
              <Ring value={phase === 'review' ? 86 : phase === 'write' ? 58 : 12} size={96} stroke={9}>
                <b className={s.num}>{phase === 'review' ? 86 : phase === 'write' ? 58 : 12}</b>
                <small>点</small>
              </Ring>
              <div>
                <p className={s.assistLabel}>検索とAI検索の両方で読まれるか</p>
                <p className={s.cardNote}>上位10記事の平均は 74点</p>
              </div>
            </div>
            <p className={s.assistSub}>キーワードの網羅</p>
            <ul className={s.scoreBars}>
              {KEYWORDS.map((k, i) => (
                <li key={k.word}>
                  <span>{k.word}</span>
                  <span className={s.scoreTrack}>
                    <span
                      key={phase}
                      style={{ '--w': phase === 'outline' ? 0.05 : phase === 'write' ? k.cover * 0.6 : k.cover, '--i': i } as CSSProperties}
                    />
                  </span>
                  <b className={s.num}>{Math.round((phase === 'review' ? k.cover : phase === 'write' ? k.cover * 0.6 : 0.05) * 100)}</b>
                </li>
              ))}
            </ul>
            <p className={s.assistSub}>仕上げのチェック</p>
            <ul className={s.checklist}>
              {CHECKS.map((c, i) => {
                const ok = phase === 'review' ? c.ok : false
                return (
                  <li key={c.label} data-ok={ok ? '' : undefined} style={{ '--i': i } as CSSProperties}>
                    <span>{ok ? <Check size={12} strokeWidth={3} /> : null}</span>
                    {c.label}
                    {phase === 'review' && !c.ok && (
                      <button type="button" className={s.fixBtn}>
                        直す
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            {phase === 'review' && (
              <button type="button" className={s.btnPrimary} data-magnetic onClick={() => setPhase('input')}>
                <span>下書きを保存して戻る</span>
                <span className={s.arw}>
                  <ArrowRight size={15} strokeWidth={2} />
                </span>
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
