'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, ChevronDown, Globe, Package } from 'lucide-react'
import rs from '../renewal.module.css'
import s from './shodan.module.css'
import { CountUp } from '../motion'
import { Badge, Field, Glass, GlowBorder, IdleCanvas, Panel, ResultHead, RunButton, RunStage, ServiceHero, Stagger, StaggerItem, Steps, TextInput, Workbench, useRun } from './kit'

const STEPS = [
  { label: '企業を調べる', log: ['会社概要のページを読んでいます', '従業員数と拠点を確認しました'] },
  { label: '施策を見る', log: ['SNSと広告の出稿状況を確認', 'ブログの更新頻度を調べました'] },
  { label: '課題を考える', log: ['調べた内容から課題の仮説を3つ作成', '重要度の順に並べました'] },
  { label: '資料をまとめる', log: ['提案資料の目次を作成', '当日の質問リストを用意しました'] },
]

const PROFILE = [
  { label: '従業員数', value: 240, unit: '人' },
  { label: '創業', value: 1987, unit: '年', plain: true },
  { label: '拠点数', value: 6, unit: '拠点' },
  { label: '推定売上', value: 48, unit: '億円' },
]

const MARKETING = [
  { name: 'SNSの運用', on: true, note: 'X と Instagram を週3回更新' },
  { name: 'Web広告', on: true, note: '検索広告のみ。ディスプレイは未実施' },
  { name: 'オウンドメディア', on: false, note: 'ブログは2年前から更新なし' },
  { name: 'メルマガ', on: false, note: '登録フォームが見つかりません' },
  { name: '動画', on: true, note: '採用向けの動画が1本' },
]

const HYPOS = [
  { title: '新規顧客の入り口が、広告だけに頼っている', why: ['ブログの更新が2年止まっている', '検索広告以外の流入口が見当たらない', '広告費が上がると問い合わせが減る形になりやすい'], top: true },
  { title: '営業の準備に時間がかかっている', why: ['拠点が6つあり、資料がばらばらになりやすい', '採用ページで営業職を増員している'], top: false },
  { title: 'AI検索で名前が出にくい', why: ['会社紹介の文が短く、強みが書かれていない', '第三者の記事に載った形跡が少ない'], top: false },
]

const SLIDES = ['表紙', '御社の現状', '課題の仮説', '解決の方向', '導入の流れ', '費用と期間', '事例', '次のステップ', '質問と回答']

const QUESTIONS = [
  '今、新しいお客様はどこから来ていますか',
  '広告費は去年と比べてどう動きましたか',
  'ブログを止めた理由は何でしたか',
  '営業資料は誰がどこで作っていますか',
  '導入を決める方は誰ですか',
  '来期までに変えたい数字はありますか',
]

export default function ShodanTool() {
  const run = useRun(STEPS)
  const [url, setUrl] = useState('https://aoba-hd.example.co.jp')
  const [product, setProduct] = useState('集客を自動化するツール')
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [checked, setChecked] = useState<number[]>([])
  const stepIdx = run.phase === 'input' ? 0 : run.phase === 'run' ? Math.min(run.step + 1, 3) : 3

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="shodan"
        catchCopy="商談の前に、相手のことが分かる"
        points={['URLから企業のプロフィールを調査', '課題の仮説を根拠つきで3つ', '提案資料の目次と質問リストまで']}
        stats={[
          { label: '準備にかかる時間', value: 5, unit: '分' },
          { label: '課題の仮説', value: 3, unit: '件' },
        ]}
      />
      <Steps steps={['URLを入れる', '企業を調べる', '課題を考える', '資料にまとめる']} current={stepIdx} />
      <Workbench
        form={
          <Panel title="商談の情報">
            <Field label="商談先のURL">
              <TextInput value={url} onChange={setUrl} icon={<Globe size={16} strokeWidth={1.75} />} ariaLabel="商談先のURL" />
            </Field>
            <Field label="自社の商材">
              <TextInput value={product} onChange={setProduct} icon={<Package size={16} strokeWidth={1.75} />} ariaLabel="自社の商材" />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run'}>
              商談の準備をする
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && <IdleCanvas serviceId="shodan" title="相手のサイトを読んで、話す内容を一緒に準備します" steps={['企業を調べる', '課題の仮説を立てる', '資料と質問をまとめる']} />}
        {run.phase === 'run' && <RunStage serviceId="shodan" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="doc" />}
        {run.phase === 'done' && (
          <div className={s.result}>
            <ResultHead title="商談の準備ができました" note="見本の内容です。実在の企業とは関係ありません" onRetry={run.reset} />

            <Stagger className={s.stack}>
              <StaggerItem>
                <Glass className={s.profile}>
                  <div className={s.profHead}>
                    <span className={s.logo}>
                      <Building2 size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <b>青葉ホールディングス</b>
                      <small>産業用部品の製造・販売</small>
                    </div>
                  </div>
                  <dl className={s.facts}>
                    {PROFILE.map((p) => (
                      <div key={p.label}>
                        <dt>{p.label}</dt>
                        <dd>
                          {p.plain ? p.value : <CountUp value={p.value} />}
                          <em>{p.unit}</em>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Glass>
              </StaggerItem>

              <StaggerItem>
                <h3 className={s.h}>マーケティングの実施状況</h3>
                <ul className={s.mk}>
                  {MARKETING.map((m, i) => (
                    <motion.li key={m.name} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.09 }}>
                      <span>{m.name}</span>
                      <Badge tone={m.on ? 'ok' : 'warn'}>{m.on ? 'あり' : 'なし'}</Badge>
                      <small>{m.note}</small>
                    </motion.li>
                  ))}
                </ul>
              </StaggerItem>

              <StaggerItem>
                <h3 className={s.h}>課題の仮説</h3>
                <div className={s.hypos}>
                  {HYPOS.map((h, i) => (
                    <GlowBorder key={h.title} on={h.top}>
                      <div className={s.hypo}>
                        <button type="button" className={s.hypoBtn} aria-expanded={openIdx === i} onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                          <span className={s.no}>{i + 1}</span>
                          <b>{h.title}</b>
                          {h.top && <Badge tone="pink">最重要</Badge>}
                          <ChevronDown size={16} className={s.chev} data-open={openIdx === i ? '' : undefined} />
                        </button>
                        <AnimatePresence initial={false}>
                          {openIdx === i && (
                            <motion.ul className={s.why} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                              {h.why.map((w) => (
                                <li key={w}>{w}</li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                    </GlowBorder>
                  ))}
                </div>
              </StaggerItem>

              <StaggerItem>
                <h3 className={s.h}>提案資料の目次</h3>
                <div className={s.rail} tabIndex={0} aria-label="提案資料の目次">
                  {SLIDES.map((t, i) => (
                    <motion.div key={t} className={s.slide} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 200, damping: 22 }} whileHover={{ y: -5 }}>
                      <span className={s.slideNo}>{String(i + 1).padStart(2, '0')}</span>
                      <i /><i /><i />
                      <b>{t}</b>
                    </motion.div>
                  ))}
                </div>
              </StaggerItem>

              <StaggerItem>
                <h3 className={s.h}>
                  当日の質問リスト
                  <small>
                    {checked.length} / {QUESTIONS.length}
                  </small>
                </h3>
                <ul className={s.qs}>
                  {QUESTIONS.map((q, i) => {
                    const on = checked.includes(i)
                    return (
                      <li key={q}>
                        <button type="button" data-on={on ? '' : undefined} onClick={() => setChecked((c) => (on ? c.filter((v) => v !== i) : [...c, i]))}>
                          <span className={s.box}>
                            <svg viewBox="0 0 12 12" aria-hidden="true">
                              <motion.path d="M2 6.5 L5 9 L10 3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 0.25 }} />
                            </svg>
                          </span>
                          {q}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </StaggerItem>
            </Stagger>
          </div>
        )}
      </Workbench>
    </div>
  )
}
