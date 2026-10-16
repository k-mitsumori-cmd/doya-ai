'use client'

// ドヤ見積もりAI：URL → 相場つきの品目 → 見積書の紙の上で編集 → PDFにする
// 見本のため生成APIは呼ばない。品目はすべて架空の見本データ。
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileDown, Globe, Info, Plus, Trash2 } from 'lucide-react'
import rs from '../renewal.module.css'
import { Odometer } from '../motion'
import {
  Badge,
  ChipSelect,
  Field,
  GhostButton,
  IdleCanvas,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  ServiceHero,
  Sheet,
  Slider,
  Steps,
  TextInput,
  Workbench,
  useFlash,
  useRun,
  type RunStep,
} from './kit'
import { getServiceById } from '@/lib/services'
import css from './quote.module.css'

const STEPS: RunStep[] = [
  { label: 'サイトを読み取る', log: ['提供形態を判定しました：月額利用と初期導入', '課金の軸を見つけました：ユーザー数'] },
  { label: '公開価格を探す', log: ['料金ページから月額の公開価格を見つけました'] },
  { label: '相場データと照らす', log: ['同じ規模の導入費の相場を引きました', '根拠のない項目は「要見積」にしました'] },
  { label: '見積書に並べる', log: ['品目を見積書の形に整えました'] },
]

type Source = 'public' | 'market' | 'ask'
type Item = { id: number; name: string; note: string; unit: string; qty: number; price: number; source: Source }

const SOURCE_LABEL: Record<Source, string> = { public: '公開価格', market: '相場データ', ask: '要見積' }
const SOURCE_TONE: Record<Source, 'ok' | 'grad' | 'warn'> = { public: 'ok', market: 'grad', ask: 'warn' }

const BASE: Omit<Item, 'id'>[] = [
  { name: '初期構築費', note: '環境設定と初期データの登録', unit: '式', qty: 1, price: 300000, source: 'market' },
  { name: '月額利用料（5ユーザー）', note: '自社サイトの料金ページに記載', unit: '月', qty: 12, price: 9800, source: 'public' },
  { name: 'データ移行', note: '既存の顧客一覧の取り込み', unit: '式', qty: 1, price: 80000, source: 'market' },
  { name: '導入研修', note: '担当者向けのオンライン研修', unit: '回', qty: 2, price: 40000, source: 'market' },
  { name: '他システムとの連携開発', note: '仕様が決まっていないため金額は出していません', unit: '式', qty: 1, price: 0, source: 'ask' },
]
const POOL: Omit<Item, 'id'>[] = [
  { name: '追加ユーザー', note: '自社サイトの料金ページに記載', unit: '月', qty: 12, price: 1500, source: 'public' },
  { name: '保守サポート', note: '問い合わせ対応と軽微な修正', unit: '月', qty: 12, price: 20000, source: 'market' },
  { name: '個別要件のご相談', note: '内容を伺ってからお見積もりします', unit: '式', qty: 1, price: 0, source: 'ask' },
]

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`

function Paper({ company, kind, onPdf, folding }: { company: string; kind: string; onPdf: () => void; folding: boolean }) {
  const [items, setItems] = useState<Item[]>([])
  const [discount, setDiscount] = useState(0)
  const [seq, setSeq] = useState(100)
  const [poolIdx, setPoolIdx] = useState(0)

  // 行を1つずつ入れる
  useEffect(() => {
    const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (quick) {
      setItems(BASE.map((b, i) => ({ ...b, id: i })))
      return
    }
    const ids = BASE.map((b, i) => window.setTimeout(() => setItems((cur) => [...cur, { ...b, id: i }]), 500 + i * 520))
    return () => ids.forEach((t) => window.clearTimeout(t))
  }, [])

  const patch = (id: number, p: Partial<Item>) => setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...p } : it)))
  const add = () => {
    const src = POOL[poolIdx % POOL.length]
    setPoolIdx((v) => v + 1)
    setItems((cur) => [...cur, { ...src, id: seq }])
    setSeq((v) => v + 1)
  }

  const sub = items.reduce((a, it) => a + it.qty * it.price, 0)
  const off = Math.round((sub * discount) / 100)
  const tax = Math.round((sub - off) * 0.1)
  const total = sub - off + tax
  const pending = items.filter((it) => it.source === 'ask' && it.price === 0).length

  return (
    <div className={css.stage}>
      <span className={css.blob} data-n="0" aria-hidden="true" />
      <span className={css.blob} data-n="1" aria-hidden="true" />
      <span className={css.blob} data-n="2" aria-hidden="true" />
      <div className={css.frost}>
        <motion.article
          className={css.paper}
          initial={{ opacity: 0, y: 40, rotate: -1.2 }}
          animate={folding ? { scale: 0.32, y: 160, rotateX: 55, opacity: 0.2 } : { opacity: 1, y: 0, rotate: 0, scale: 1, rotateX: 0 }}
          transition={folding ? { duration: 0.65, ease: [0.5, 0, 0.75, 0] } : { type: 'spring', stiffness: 220, damping: 24 }}
        >
          <header className={css.pHead}>
            <div>
              <p className={css.pKicker}>見積書</p>
              <h2 className={css.pTitle}>{company || 'お客さま名'} 御中</h2>
              <p className={css.pMeta}>件名：{kind}の導入　/　見積番号 Q-2026-0142</p>
            </div>
            <div className={css.pStamp} aria-hidden="true">
              見本
            </div>
          </header>

          <div className={css.pTotalBar}>
            <span>ご請求予定額（税込）</span>
            <b>
              ¥<Odometer key={total} value={total} />
            </b>
          </div>

          <div className={css.cols} aria-hidden="true">
            <span>品目</span>
            <span>数量</span>
            <span>単価</span>
            <span>金額</span>
            <span />
          </div>
          <ul className={css.rows}>
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  className={css.row}
                  initial={{ opacity: 0, x: -24, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 40, height: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                >
                  <div className={css.cName}>
                    <p>
                      {it.name}
                      <Badge tone={SOURCE_TONE[it.source]}>{SOURCE_LABEL[it.source]}</Badge>
                    </p>
                    <small>{it.note}</small>
                  </div>
                  <label className={css.cNum} data-k="数量">
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => patch(it.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={`${it.name}の数量`}
                    />
                    <em>{it.unit}</em>
                  </label>
                  <label className={css.cNum} data-k="単価">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={it.price}
                      placeholder="未定"
                      onChange={(e) => patch(it.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label={`${it.name}の単価`}
                    />
                    <em>円</em>
                  </label>
                  <span className={css.cAmt} data-k="金額">
                    {it.source === 'ask' && it.price === 0 ? '要見積' : yen(it.qty * it.price)}
                  </span>
                  <button type="button" className={css.del} onClick={() => setItems((cur) => cur.filter((x) => x.id !== it.id))} aria-label={`${it.name}を削除`}>
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <button type="button" className={css.addBtn} onClick={add}>
            <Plus size={14} strokeWidth={2.6} />
            品目を追加する
          </button>

          <div className={css.sum}>
            <div className={css.disc}>
              <p>
                値引き<b>{discount}%</b>
              </p>
              <Slider value={discount} min={0} max={20} step={1} onChange={setDiscount} format={(v) => `${v}%`} ariaLabel="値引き率" />
            </div>
            <dl>
              <div>
                <dt>小計</dt>
                <dd>{yen(sub)}</dd>
              </div>
              <AnimatePresence initial={false}>
                {discount > 0 && (
                  <motion.div key="off" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={css.off}>
                    <dt>値引き</dt>
                    <dd>-{yen(off)}</dd>
                  </motion.div>
                )}
              </AnimatePresence>
              <div>
                <dt>消費税（10%）</dt>
                <dd>{yen(tax)}</dd>
              </div>
              <div className={css.grand}>
                <dt>合計</dt>
                <dd>{yen(total)}</dd>
              </div>
            </dl>
          </div>

          <p className={css.honest}>
            <Info size={13} strokeWidth={2.4} />
            根拠のない金額は作りません。公開価格か相場データで裏づけられない品目は「要見積」のままにします。
            {pending > 0 && `（いま要見積：${pending}件）`}
          </p>
        </motion.article>
      </div>
      <div className={css.stageActions}>
        <button type="button" className={css.pdfBtn} onClick={onPdf}>
          <FileDown size={15} strokeWidth={2.4} />
          PDFにする
        </button>
      </div>
    </div>
  )
}

export default function QuoteTool() {
  const svc = getServiceById('quote')
  const [url, setUrl] = useState('https://sample-crm.example.jp')
  const [company, setCompany] = useState('サンプル商事株式会社')
  const [kind, setKind] = useState<'月額サービス' | '制作・受託' | '保守運用'>('月額サービス')
  const run = useRun(STEPS)
  const [flashNode, flash] = useFlash()
  const [folding, setFolding] = useState(false)
  const [sheet, setSheet] = useState(false)

  const toPdf = useCallback(() => {
    setFolding(true)
    window.setTimeout(() => setSheet(true), 650)
  }, [])
  const closeSheet = () => {
    setSheet(false)
    setFolding(false)
  }
  const cur = run.phase === 'input' ? 0 : run.phase === 'run' ? 1 : sheet ? 3 : 2
  const fileName = useMemo(() => '見積書_Q-2026-0142.pdf', [])

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="quote"
        catchCopy={`${svc?.shortName ?? '見積もり'}を、URLからその場で`}
        points={['品目と相場をURLから自動で提示', '金額の出どころがひと目でわかる', '商談中に編集してそのままPDF']}
        stats={[
          { label: '見積書ができるまで', value: 3, unit: '分' },
          { label: '根拠つきの品目', value: 80, unit: '%' },
        ]}
      />
      <Steps steps={['URLを入れる', '品目を探す', '見積書を整える', 'PDFにする']} current={cur} />
      <Workbench
        form={
          <Panel title="見積もりの条件">
            <Field label="自社サービスのURL">
              <TextInput value={url} onChange={setUrl} icon={<Globe size={16} strokeWidth={1.75} />} ariaLabel="自社サービスのURL" />
            </Field>
            <Field label="宛先の会社名">
              <TextInput value={company} onChange={setCompany} ariaLabel="宛先の会社名" />
            </Field>
            <Field label="提供の形">
              <ChipSelect id="quote-kind" options={['月額サービス', '制作・受託', '保守運用'] as const} value={kind} onChange={setKind} />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run' || !url.trim()}>
              品目を提案してもらう
            </RunButton>
          </Panel>
        }
        wide
      >
        {run.phase === 'input' && (
          <IdleCanvas serviceId="quote" title="公開価格と相場から、根拠のある品目だけを並べます" steps={['サイトを読む', '公開価格を探す', '相場と照らす', '見積書にする']} />
        )}
        {run.phase === 'run' && <RunStage serviceId="quote" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="doc" />}
        {run.phase === 'done' && (
          <div className={css.result}>
            <ResultHead
              title="見積書の下書きができました"
              note="数量と単価はその場で直せます。値引きも動かせます。"
              onRetry={run.reset}
              actions={
                <GhostButton onClick={toPdf} icon={<FileDown size={14} />}>
                  PDFにする
                </GhostButton>
              }
            />
            <Paper company={company} kind={kind} onPdf={toPdf} folding={folding} />
          </div>
        )}
      </Workbench>
      <Sheet open={sheet} onClose={closeSheet} title="PDFを書き出しました">
        <div className={css.file}>
          <span className={css.fileIcon} aria-hidden="true">
            <FileDown size={22} strokeWidth={2} />
          </span>
          <div>
            <p>{fileName}</p>
            <small>A4 / 1ページ / 約 84 KB</small>
          </div>
        </div>
        <p className={css.fileNote}>見本のため、実際のファイルは作られません。本番ではここからダウンロードや共有ができます。</p>
        <div className={css.fileActions}>
          <GhostButton onClick={closeSheet}>閉じて続きを編集</GhostButton>
          <button
            type="button"
            className={css.pdfBtn}
            onClick={() => {
              flash('ダウンロードしました（見本）')
              closeSheet()
            }}
          >
            ダウンロード
          </button>
        </div>
      </Sheet>
      {flashNode}
    </div>
  )
}
