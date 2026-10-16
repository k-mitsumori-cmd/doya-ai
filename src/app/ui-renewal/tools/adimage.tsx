'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Download, Globe, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import rs from '../renewal.module.css'
import c from './adimage.module.css'
import {
  Badge,
  ChipMulti,
  Field,
  GhostButton,
  IdleCanvas,
  Meter,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  Sheet,
  Stagger,
  StaggerItem,
  Tabs,
  TextInput,
  TiltCard,
  Workbench,
  Steps,
  ServiceHero,
  useFlash,
  useRun,
  type RunStep,
} from './kit'

const STEPS: RunStep[] = [
  { label: 'サイトを読み取る', log: ['ページの見出しと商品写真を取得しました', '色とロゴのトーンを抽出しました'] },
  { label: 'コピーを考える', log: ['訴求を3パターン作りました', '媒体の文字数制限に合わせて整えました'] },
  { label: '各サイズで描く', log: ['比率ごとに画像を生成しています', '文字を画像に描き込みました'] },
  { label: '文字を検査する', log: ['描かれた文字を自動で読み取り照合しました', '不合格はありませんでした'] },
]

const MEDIA = ['Meta', 'Google', 'X', 'LINE', 'Yahoo!'] as const
type Media = (typeof MEDIA)[number]

type Slot = { id: string; place: string; ratio: string; w: number; h: number; img: string; copy: string; px: string }
const SAMPLE = {
  food: '/banner-samples/cat-food.webp',
  beauty: '/banner-samples/cat-beauty.webp',
  ec: '/banner-samples/cat-ec.webp',
  it: '/banner-samples/cat-it.webp',
  sns: '/banner-samples/purpose-sns_ad.webp',
  campaign: '/banner-samples/purpose-campaign.webp',
  display: '/banner-samples/purpose-display.webp',
  lp: '/banner-samples/purpose-lp_hero.webp',
}
const COPIES = ['はじめての方は初月無料', '手間はAIにおまかせ', '今日から使える新定番', '選ばれる理由があります']

const mk = (id: string, place: string, ratio: string, w: number, h: number, img: string, i: number): Slot => ({
  id,
  place,
  ratio,
  w,
  h,
  img,
  copy: COPIES[i % COPIES.length],
  px: `${w}x${h}`,
})

const SLOTS: Record<Media, Slot[]> = {
  Meta: [
    mk('m1', 'フィード', '1:1', 1080, 1080, SAMPLE.sns, 0),
    mk('m2', 'ストーリーズ', '9:16', 1080, 1920, SAMPLE.campaign, 1),
    mk('m3', 'フィード縦', '4:5', 1080, 1350, SAMPLE.beauty, 2),
    mk('m4', 'リンク広告', '1.91:1', 1200, 628, SAMPLE.display, 3),
  ],
  Google: [
    mk('g1', 'ディスプレイ横', '1.91:1', 1200, 628, SAMPLE.it, 0),
    mk('g2', 'ディスプレイ正方形', '1:1', 1200, 1200, SAMPLE.lp, 1),
    mk('g3', 'ディスプレイ縦', '4:5', 960, 1200, SAMPLE.ec, 2),
  ],
  X: [
    mk('x1', 'タイムライン', '1.91:1', 1200, 628, SAMPLE.sns, 3),
    mk('x2', '正方形', '1:1', 1080, 1080, SAMPLE.food, 0),
    mk('x3', '縦長', '4:5', 1080, 1350, SAMPLE.campaign, 1),
  ],
  LINE: [
    mk('l1', 'カードタイプ', '1.91:1', 1200, 628, SAMPLE.beauty, 2),
    mk('l2', 'スクエア', '1:1', 1080, 1080, SAMPLE.display, 3),
    mk('l3', 'ストーリー', '9:16', 1080, 1920, SAMPLE.lp, 0),
  ],
  'Yahoo!': [
    mk('y1', 'ディスプレイ横', '1.91:1', 1200, 628, SAMPLE.ec, 1),
    mk('y2', '正方形', '1:1', 1200, 1200, SAMPLE.it, 2),
    mk('y3', '縦長', '9:16', 1080, 1920, SAMPLE.food, 3),
  ],
}

const SCORE_ITEMS = [
  { label: '文字の読みやすさ', v: 92 },
  { label: '商品の見せ方', v: 85 },
  { label: '訴求のわかりやすさ', v: 88 },
  { label: '媒体ルールへの適合', v: 96 },
]

export default function AdImageTool() {
  const [url, setUrl] = useState('https://example-sample.jp/service')
  const [media, setMedia] = useState<string[]>(['Meta', 'Google', 'LINE'])
  const run = useRun(STEPS)
  const [tab, setTab] = useState<Media>('Meta')
  const [open, setOpen] = useState<Slot | null>(null)
  const [scored, setScored] = useState<Record<string, number>>({})
  const [scoring, setScoring] = useState(false)
  const [flash, say] = useFlash()

  const active = useMemo(() => MEDIA.filter((m) => media.includes(m)), [media])
  const curTab = active.includes(tab) ? tab : active[0]
  const total = active.reduce((n, m) => n + SLOTS[m].length, 0)

  const start = () => {
    setScored({})
    run.start()
  }

  const score = (s: Slot) => {
    setScoring(true)
    window.setTimeout(() => {
      setScoring(false)
      setScored((o) => ({ ...o, [s.id]: 90 }))
    }, 900)
  }

  const form = (
    <>
      <Panel title="サービスのURL">
        <Field label="広告にしたいページ">
          <TextInput value={url} onChange={setUrl} icon={<Globe size={16} strokeWidth={1.75} />} ariaLabel="サービスURL" />
        </Field>
      </Panel>
      <Panel title="出稿する媒体">
        <Field label="複数選べます" hint={`${media.length}媒体`}>
          <ChipMulti options={MEDIA} value={media} onChange={setMedia} />
        </Field>
      </Panel>
      <RunButton onClick={start} disabled={!url || media.length === 0}>
        広告画像をつくる
      </RunButton>
    </>
  )

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="adimage"
        catchCopy="URLを貼るだけで、広告画像が全サイズそろう"
        points={['媒体と配置ごとに比率ぴったり', '文字は画像に描き込み済み', '描かれた文字を自動で検査']}
        stats={[
          { label: '1回で出る画像', value: 14, unit: '枚' },
          { label: '文字の検査合格', value: 100, unit: '%' },
        ]}
      />
      <Steps steps={['URLを読む', 'コピーを考える', '各サイズで描く', '検査して納品']} current={run.phase === 'input' ? 0 : run.phase === 'done' ? 3 : Math.min(run.step, 3)} />
      <Workbench form={form}>
        {run.phase === 'input' && (
          <IdleCanvas serviceId="adimage" title="URLから、媒体別の広告画像を一度につくります" steps={['サイトを読み取る', 'コピーを考える', '各サイズで描く', '文字を検査する']} />
        )}
        {run.phase === 'run' && <RunStage serviceId="adimage" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="cards" />}
        {run.phase === 'done' && (
          <div className={c.done}>
            <ResultHead
              title={`${total}枚の広告画像ができました`}
              note="すべて目標サイズと同じ比率で生成し、文字の検査に合格しています"
              onRetry={run.reset}
              actions={
                <GhostButton onClick={() => say('媒体別のZIPをダウンロードしました（見本）')} icon={<Download size={14} />}>
                  一括でダウンロード
                </GhostButton>
              }
            />
            <Tabs id="adimage-media" tabs={active.map((m) => ({ id: m, label: m, count: SLOTS[m].length }))} value={curTab} onChange={setTab} />
            <Stagger key={curTab} className={c.masonry}>
              {SLOTS[curTab].map((s) => (
                <StaggerItem key={s.id} className={c.item}>
                  <TiltCard max={6}>
                    <button type="button" className={c.frame} style={{ aspectRatio: `${s.w} / ${s.h}` } as CSSProperties} onClick={() => setOpen(s)} aria-label={`${s.place} ${s.ratio} を大きく見る`}>
                      <img src={s.img} alt="" className={c.img} />
                      <span className={c.shade} />
                      <span className={c.copy}>{s.copy}</span>
                      <span className={c.ok}>
                        <ShieldCheck size={12} strokeWidth={2.6} />
                        文字の検査 合格
                      </span>
                      <span className={c.meta}>
                        {s.ratio}
                        <small>{s.px}</small>
                      </span>
                    </button>
                    <p className={c.cap}>
                      {s.place}
                      {scored[s.id] && <Badge tone="ok">採点 {scored[s.id]}点</Badge>}
                    </p>
                  </TiltCard>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}
      </Workbench>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${curTab} / ${open.place}（${open.ratio}）` : ''}>
        {open && (
          <div className={c.sheetBody}>
            <div className={c.big} style={{ aspectRatio: `${open.w} / ${open.h}`, width: `min(100%, ${((55 * open.w) / open.h).toFixed(1)}vh)` } as CSSProperties}>
              <img src={open.img} alt="" className={c.img} />
              <span className={c.shade} />
              <span className={`${c.copy} ${c.copyBig}`}>{open.copy}</span>
              <span className={c.ok}>
                <ShieldCheck size={12} strokeWidth={2.6} />
                文字の検査 合格
              </span>
            </div>
            <div className={c.score}>
              <p className={c.px}>
                出力サイズ {open.px}。切り抜きなしで縮小しています。
              </p>
              <RunButton onClick={() => score(open)} icon={<Wand2 size={15} />} disabled={scoring}>
                {scoring ? 'AIが見ています' : 'AIが採点'}
              </RunButton>
              {scored[open.id] ? (
                <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={c.meters}>
                  {SCORE_ITEMS.map((it, i) => (
                    <Meter key={it.label} label={it.label} value={it.v} suffix="点" i={i} />
                  ))}
                  <p className={c.tip}>
                    <Sparkles size={13} /> 提案：コピーを少し短くすると、小さな配置でもさらに読みやすくなります。
                  </p>
                </motion.div>
              ) : (
                <p className={c.hint}>ボタンを押すと、AIが実際の画像を見て採点します。</p>
              )}
            </div>
          </div>
        )}
      </Sheet>
      {flash}
    </div>
  )
}
