'use client'

import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Globe, Link2, MessageCircle, Play, X } from 'lucide-react'
import rs from '../renewal.module.css'
import s from './asklink.module.css'
import {
  Badge,
  Field,
  Glass,
  IdleCanvas,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  Stagger,
  StaggerItem,
  Steps,
  TextInput,
  Typewriter,
  Workbench,
  ServiceHero,
  TiltCard,
  useFlash,
  useRun,
} from './kit'

const STEPS = [
  { label: 'サイトを読む', log: ['ページを取得しています', '会社名と主な商品を抜き出しました'] },
  { label: '質問文を作る', log: ['お客様が聞きそうな質問を洗い出し中', 'AIに伝わる言い回しに整えました'] },
  { label: 'リンクを作る', log: ['AIに聞くリンクを2本作成', 'ポップアップの文言を調整'] },
  { label: 'バナーを描く', log: ['3つのサイズに合わせて配置', '色をサイトに合わせました'] },
]

const LINKS = [
  {
    id: 'a',
    title: '会社を知りたい人向け',
    tag: '認知',
    q: 'サンプル商事はどんな会社ですか。強みと実績を3つ教えてください。',
    url: 'https://chatgpt.com/?q=サンプル商事の強みと実績',
  },
  {
    id: 'b',
    title: '比較している人向け',
    tag: '比較検討',
    q: 'サンプル商事のサービスと他社の違いを、料金と導入のしやすさで比べてください。',
    url: 'https://chatgpt.com/?q=サンプル商事と他社の違い',
  },
]

const BANNERS = [
  { id: 'wide', label: '横長', size: '728 x 90', w: 364, h: 45 },
  { id: 'rect', label: '正方形', size: '300 x 250', w: 150, h: 125 },
  { id: 'tall', label: '縦長', size: '160 x 600', w: 80, h: 300 },
]

export default function AskLinkTool() {
  const run = useRun(STEPS)
  const [url, setUrl] = useState('https://sample-shoji.example.jp')
  const [flash, setFlash] = useFlash()
  const [popKey, setPopKey] = useState(0)
  const [popOpen, setPopOpen] = useState(true)
  const stepIdx = run.phase === 'input' ? 0 : run.phase === 'run' ? Math.min(run.step + 1, 3) : 3

  const replay = () => {
    setPopOpen(false)
    window.setTimeout(() => {
      setPopKey((k) => k + 1)
      setPopOpen(true)
    }, 350)
  }

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="asklink"
        catchCopy="サイトに「AIに聞く」を置く"
        points={['サイトのURLだけでリンクを2本作成', 'ポップアップを実寸で確認', 'バナーを3サイズ同時に用意']}
        stats={[
          { label: 'AI経由の来訪', value: 38, unit: '%増' },
          { label: '作成にかかる時間', value: 3, unit: '分' },
        ]}
      />
      <Steps steps={['サイトを入れる', '質問文を作る', 'リンクを作る', '確認して置く']} current={stepIdx} />
      <Workbench
        form={
          <Panel title="サイトの情報">
            <Field label="サイトのURL">
              <TextInput value={url} onChange={setUrl} icon={<Globe size={16} strokeWidth={1.75} />} ariaLabel="サイトのURL" />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run'}>
              リンクを作る
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && (
          <IdleCanvas
            serviceId="asklink"
            title="サイトを読んで、お客様がAIに聞きたくなる質問を用意します"
            steps={['サイトを読む', '質問文を作る', 'リンクとバナーを作る']}
          />
        )}
        {run.phase === 'run' && <RunStage serviceId="asklink" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} />}
        {run.phase === 'done' && (
          <div className={s.result}>
            <ResultHead title="リンクとバナーができました" note="サイトのどこにでも貼れます" onRetry={run.reset} />

            <Stagger className={s.links}>
              {LINKS.map((l) => (
                <StaggerItem key={l.id}>
                  <TiltCard max={5}>
                    <div className={s.linkCard}>
                      <div className={s.linkHead}>
                        <span className={s.linkIcon}>
                          <Link2 size={15} strokeWidth={2.2} />
                        </span>
                        <b>{l.title}</b>
                        <Badge tone="grad">{l.tag}</Badge>
                      </div>
                      <p className={s.question}>
                        <MessageCircle size={14} strokeWidth={2} />
                        <Typewriter text={l.q} speed={32} />
                      </p>
                      <code className={s.url}>{l.url}</code>
                      <button type="button" className={s.copyBtn} onClick={() => setFlash('コピーしました')}>
                        <Copy size={13} strokeWidth={2.2} />
                        リンクをコピー
                      </button>
                    </div>
                  </TiltCard>
                </StaggerItem>
              ))}
            </Stagger>

            <section className={s.block}>
              <div className={s.blockHead}>
                <h3>ポップアップの見え方</h3>
                <button type="button" className={s.playBtn} onClick={replay}>
                  <Play size={12} strokeWidth={2.4} />
                  もう一度見る
                </button>
              </div>
              <div className={s.browser}>
                <div className={s.bar}>
                  <i />
                  <i />
                  <i />
                  <span>sample-shoji.example.jp</span>
                </div>
                <div className={s.page}>
                  <span className={s.skelH} />
                  <span className={s.skelL} style={{ width: '70%' } as CSSProperties} />
                  <span className={s.skelL} style={{ width: '84%' } as CSSProperties} />
                  <span className={s.skelL} style={{ width: '56%' } as CSSProperties} />
                  <div className={s.skelRow}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <AnimatePresence>
                    {popOpen && (
                      <motion.div
                        key={popKey}
                        className={s.popup}
                        initial={{ opacity: 0, y: 60, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.3 }}
                      >
                        <button type="button" className={s.popClose} aria-label="閉じる" onClick={() => setPopOpen(false)}>
                          <X size={13} strokeWidth={2.4} />
                        </button>
                        <p className={s.popLead}>気になることを、AIに聞いてみませんか</p>
                        <span className={s.popBtn}>サンプル商事の強みを聞く</span>
                        <span className={s.popBtn2}>他社との違いを聞く</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            <section className={s.block}>
              <div className={s.blockHead}>
                <h3>バナー 3サイズ</h3>
                <span className={s.note}>そのまま広告やサイトに置けます</span>
              </div>
              <Glass className={s.banners}>
                {BANNERS.map((b) => (
                  <div key={b.id} className={s.bannerWrap}>
                    <div className={s.banner} data-k={b.id} style={{ width: b.w, height: b.h } as CSSProperties}>
                      <span className={s.bannerText}>AIに聞いてみる</span>
                      <span className={s.bannerBtn}>質問する</span>
                    </div>
                    <small>
                      {b.label} <em>{b.size}</em>
                    </small>
                  </div>
                ))}
              </Glass>
            </section>
          </div>
        )}
      </Workbench>
      {flash}
    </div>
  )
}
