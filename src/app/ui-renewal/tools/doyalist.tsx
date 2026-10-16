'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, Copy, MapPin, X } from 'lucide-react'
import rs from '../renewal.module.css'
import s from './doyalist.module.css'
import { Badge, ChipSelect, Field, IdleCanvas, Meter, Panel, ResultHead, RunButton, RunStage, ServiceHero, Slider, Steps, Tabs, TextInput, Typewriter, Workbench, useFlash, useRun } from './kit'

const STEPS = [
  { label: '条件を読む', log: ['業界と地域を確認しました', '規模の目安を従業員数に置き換え'] },
  { label: '企業を探す', log: ['公開情報から候補を集めています', '条件に合う企業を絞り込み中'] },
  { label: '見込みを採点', log: ['課題がありそうな企業を上位に', 'スコアを0〜100で付けました'] },
  { label: '文面を書く', log: ['フォーム用の短い文面を作成', 'メールと電話の台本を用意'] },
]

const INDUSTRIES = ['製造', '小売', '飲食', '不動産', '建設', '医療', '教育', 'IT'] as const
const AREAS = ['東京', '大阪', '愛知', '福岡', '北海道'] as const

type Co = { id: number; name: string; area: string; size: number; score: number; pain: string }
const NAMES = ['みらい工業', '青葉ホールディングス', '北斗サービス', 'さくら商会', '大和テック', '光洋製作所', 'ひので食品', '緑風開発', '白鳥システムズ', '丸山興産', '星野ロジ', '八雲デザイン', '千代田メディカル', '桜井ストア', 'あかつき建設']
const PAINS = ['問い合わせ対応が属人化している', '広告費に対して来店が増えていない', '新規の取引先が伸び悩んでいる', '採用の応募が減っている', '資料づくりに時間がかかっている']
const SCORES = [94, 91, 88, 85, 82, 79, 76, 73, 70, 66, 63, 59, 55, 51, 47]

const SCRIPTS = {
  form: (c: Co) => `${c.name}の ご担当者様\n\nはじめてご連絡します。${c.pain}という声を、同じ規模の会社さまからよく伺います。資料づくりの手間を減らす方法を、10分だけご紹介できればと存じます。ご都合のよい日時をお知らせください。`,
  mail: (c: Co) => `件名：${c.name}さまの業務を軽くするご提案\n\nご担当者様\n\n突然のご連絡失礼いたします。${c.area}の同業の会社さまを中心に、${c.pain}というお悩みをうかがっております。\n\n作業時間を減らした事例をまとめましたので、よろしければ5分ほどお話しできませんか。`,
  tel: (c: Co) => `1. 名乗る：サンプル社の営業担当です。\n2. 理由：${c.area}の同業の会社さまにご案内しております。\n3. 確認：${c.pain}ことはありませんか。\n4. 提案：10分だけ事例をご紹介してよいですか。\n5. 断られたら：資料をメールでお送りしてよいですか。`,
}
type ScriptKey = keyof typeof SCRIPTS
type SortKey = 'score' | 'size' | 'name'

export default function DoyaListTool() {
  const run = useRun(STEPS)
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>('製造')
  const [area, setArea] = useState('東京')
  const [size, setSize] = useState(100)
  const [flash, setFlash] = useFlash()
  const [shown, setShown] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'score', dir: -1 })
  const [picked, setPicked] = useState<number[]>([])
  const [open, setOpen] = useState<Co | null>(null)
  const [tab, setTab] = useState<ScriptKey>('form')

  const list: Co[] = useMemo(
    () =>
      NAMES.map((n, i) => ({
        id: i,
        name: n,
        area: i % 4 === 3 ? '近隣' : area,
        size: Math.max(5, Math.round(size * (0.4 + ((i * 37) % 17) / 8))),
        score: SCORES[i],
        pain: PAINS[i % PAINS.length],
      })),
    [area, size],
  )

  useEffect(() => {
    if (run.phase !== 'done') {
      setShown(0)
      return
    }
    setPicked([])
    setOpen(null)
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= list.length) window.clearInterval(id)
    }, 130)
    return () => window.clearInterval(id)
  }, [run.phase, list.length])

  const rows = useMemo(() => {
    const a = [...list].sort((x, y) => {
      const k = sort.key
      const r = k === 'name' ? x.name.localeCompare(y.name, 'ja') : x[k] - y[k]
      return r * sort.dir
    })
    return a
  }, [list, sort])
  const visible = new Set(list.slice(0, shown).map((c) => c.id))
  const shownRows = rows.filter((r) => visible.has(r.id))

  const head = (key: SortKey, label: string) => (
    <button type="button" className={s.th} data-on={sort.key === key ? '' : undefined} onClick={() => setSort((p) => ({ key, dir: p.key === key ? ((p.dir * -1) as 1 | -1) : -1 }))}>
      {label}
      {sort.key === key && (sort.dir === -1 ? <ArrowDown size={12} strokeWidth={2.6} /> : <ArrowUp size={12} strokeWidth={2.6} />)}
    </button>
  )
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((v) => v !== id) : [...p, id]))
  const stepIdx = run.phase === 'input' ? 0 : run.phase === 'run' ? Math.min(run.step + 1, 3) : 3

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="doyalist"
        catchCopy="会いたい会社が、見込み順に並ぶ"
        points={['業界・地域・規模から企業を探す', '見込み度を点数で並べ替え', 'フォーム・メール・電話の文面つき']}
        stats={[
          { label: '1回で作る件数', value: 100, unit: '社' },
          { label: '文面の作成', value: 3, unit: '種類' },
        ]}
      />
      <Steps steps={['条件を決める', '企業を探す', '見込みを採点', '文面を選ぶ']} current={stepIdx} />
      <Workbench
        wide
        form={
          <Panel title="探す条件">
            <Field label="業界">
              <ChipSelect id="dl-ind" options={INDUSTRIES} value={industry} onChange={setIndustry} />
            </Field>
            <Field label="地域">
              <TextInput value={area} onChange={setArea} icon={<MapPin size={16} strokeWidth={1.75} />} ariaLabel="地域" />
              <div className={s.quick}>
                {AREAS.map((a) => (
                  <button key={a} type="button" onClick={() => setArea(a)} data-on={a === area ? '' : undefined}>
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="会社の規模" hint="従業員数の目安">
              <Slider value={size} min={10} max={500} step={10} onChange={setSize} format={(v) => `${v}人`} ariaLabel="規模" />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run'}>
              リストを作る
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && <IdleCanvas serviceId="doyalist" title="条件に合う会社を探し、見込みの高い順に並べます" steps={['企業を探す', '見込み度を採点', '営業の文面を書く']} />}
        {run.phase === 'run' && <RunStage serviceId="doyalist" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="rows" />}
        {run.phase === 'done' && (
          <div className={s.result}>
            <ResultHead title={`${industry}の企業 ${list.length}社が見つかりました`} note="見出しを押すと並べ替わります。行を押すと文面が出ます" onRetry={run.reset} />

            <AnimatePresence>
              {picked.length > 0 && (
                <motion.div className={s.selBar} initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }}>
                  <span>
                    <b>{picked.length}</b>社を選んでいます
                  </span>
                  <button type="button" onClick={() => setFlash(`${picked.length}社の文面をコピーしました`)}>
                    <Copy size={13} /> まとめてコピー
                  </button>
                  <button type="button" onClick={() => setPicked([])}>
                    選択をはずす
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={s.table} role="table">
              <div className={s.headRow} role="row">
                <span />
                {head('name', '会社名')}
                <span className={s.thPlain}>地域</span>
                {head('size', '従業員')}
                {head('score', '見込み度')}
              </div>
              <AnimatePresence initial={false}>
                {shownRows.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 }, duration: 0.3 }}
                    className={s.row}
                    data-sel={picked.includes(c.id) ? '' : undefined}
                    role="row"
                    onClick={() => {
                      setOpen(c)
                      setTab('form')
                    }}
                  >
                    <button type="button" className={s.check} data-on={picked.includes(c.id) ? '' : undefined} aria-label={`${c.name}を選ぶ`} onClick={(e) => { e.stopPropagation(); toggle(c.id) }}>
                      {picked.includes(c.id) && <Check size={12} strokeWidth={3.4} />}
                    </button>
                    <span className={s.name} data-label="">
                      <b>{c.name}</b>
                      <small>{c.pain}</small>
                    </span>
                    <span className={s.cell} data-k="地域">{c.area}</span>
                    <span className={s.cell} data-k="従業員">{c.size}人</span>
                    <span className={s.score}>
                      <Meter label="" value={c.score} i={0} />
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {open && (
                <>
                  <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
                  <motion.aside className={s.panel} role="dialog" aria-label={`${open.name}の詳細`} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 36 }}>
                    <button type="button" className={s.close} aria-label="閉じる" onClick={() => setOpen(null)}>
                      <X size={16} />
                    </button>
                    <h3>{open.name}</h3>
                    <p className={s.meta}>
                      <Badge tone="grad">見込み度 {open.score}</Badge>
                      <Badge tone="muted">{open.area}</Badge>
                      <Badge tone="muted">従業員 {open.size}人</Badge>
                    </p>
                    <p className={s.pain}>想定される課題：{open.pain}</p>
                    <Tabs id="dl-tab" value={tab} onChange={setTab} tabs={[{ id: 'form', label: 'フォーム文' }, { id: 'mail', label: 'メール' }, { id: 'tel', label: '電話' }]} />
                    <pre className={s.script} key={`${open.id}-${tab}`}>
                      <Typewriter text={SCRIPTS[tab](open)} speed={14} />
                    </pre>
                    <button type="button" className={s.copy} onClick={() => setFlash('コピーしました')}>
                      <Copy size={14} /> 文面をコピー
                    </button>
                  </motion.aside>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </Workbench>
      {flash}
    </div>
  )
}
