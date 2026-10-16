'use client'

// ドヤHR（見本）：従業員データベース＋評価コメント生成。すべて架空の社員データ。
import { useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Sparkles, UserRound, X } from 'lucide-react'
import rs from '../renewal.module.css'
import h from './hr.module.css'
import { Ring } from '../motion'
import { Badge, ChipSelect, Glass, GlowBorder, Meter, RunButton, ServiceHero, Sparkline, StatTile, Typewriter } from './kit'

type Dept = '営業' | '開発' | '管理' | 'CS'
type Emp = { id: string; name: string; role: string; dept: Dept; years: number; hue: number; skills: [string, number][]; trend: number[]; comment: string }

const EMPS: Emp[] = [
  { id: 'e1', name: '青山 凛', role: '営業リーダー', dept: '営業', years: 6.2, hue: 210, skills: [['提案力', 90], ['交渉', 84], ['数字管理', 72]], trend: [3.4, 3.6, 3.9, 4.1, 4.3, 4.5], comment: '提案の質が安定して高く、後輩の同行指導でもチームの受注率を押し上げています。次は数字の見通しを早めに共有できると、さらに頼れる存在になります。' },
  { id: 'e2', name: '石川 湊', role: 'エンジニア', dept: '開発', years: 3.8, hue: 160, skills: [['設計', 82], ['品質', 88], ['説明力', 64]], trend: [3.0, 3.2, 3.1, 3.6, 3.8, 4.0], comment: '不具合の原因を素早く切り分け、レビューも丁寧です。仕様の背景を周囲に話す機会を増やすと、影響力がより広がります。' },
  { id: 'e3', name: '上野 美波', role: '経理', dept: '管理', years: 9.1, hue: 30, skills: [['正確さ', 95], ['改善力', 70], ['連携', 76]], trend: [4.2, 4.2, 4.3, 4.3, 4.4, 4.4], comment: '月次の締めを毎回期日前に終えています。入力の手順書づくりを進めたことで、引き継ぎの負担も軽くなりました。' },
  { id: 'e4', name: '江口 蓮', role: 'CSリーダー', dept: 'CS', years: 4.5, hue: 330, skills: [['傾聴', 92], ['解決力', 80], ['教育', 68]], trend: [3.5, 3.7, 3.8, 4.0, 4.0, 4.2], comment: 'お客さまの不安を先に受け止める対応が、満足度の高さにつながっています。新人向けの対応集を一緒に整えていきましょう。' },
  { id: 'e5', name: '小川 彩', role: '営業', dept: '営業', years: 1.6, hue: 280, skills: [['提案力', 66], ['行動量', 90], ['数字管理', 58]], trend: [2.6, 2.9, 3.1, 3.3, 3.6, 3.8], comment: '訪問の行動量が際立ち、半年で評価が着実に伸びています。提案資料の型を身につけると、次の段階へ進めます。' },
  { id: 'e6', name: '加藤 悠真', role: 'エンジニア', dept: '開発', years: 7.3, hue: 190, skills: [['設計', 94], ['品質', 90], ['育成', 78]], trend: [4.0, 4.1, 4.3, 4.3, 4.5, 4.6], comment: '全体設計を任せられる中心人物です。レビューを通じた育成も浸透し、チーム全体の水準を引き上げています。' },
  { id: 'e7', name: '木村 結衣', role: '人事', dept: '管理', years: 2.9, hue: 350, skills: [['調整', 84], ['傾聴', 86], ['制度設計', 60]], trend: [3.1, 3.3, 3.5, 3.5, 3.8, 3.9], comment: '面談の調整が丁寧で、社員から相談しやすい存在です。制度づくりにも少しずつ関わる機会を増やしましょう。' },
  { id: 'e8', name: '久保 大地', role: 'CS', dept: 'CS', years: 0.9, hue: 120, skills: [['傾聴', 74], ['解決力', 62], ['知識', 58]], trend: [2.8, 3.0, 3.1, 3.4, 3.5, 3.7], comment: '入社から1年足らずで、基本の対応を着実に身につけています。製品知識を広げると、解決までの時間がさらに縮まります。' },
  { id: 'e9', name: '斎藤 玲奈', role: '営業', dept: '営業', years: 5.0, hue: 55, skills: [['提案力', 80], ['関係構築', 92], ['数字管理', 74]], trend: [3.6, 3.8, 3.7, 4.0, 4.1, 4.2], comment: '長いお付き合いのお客さまが多く、追加受注の割合が高いです。新規開拓の時間を週に半日確保すると良さそうです。' },
  { id: 'e10', name: '清水 拓海', role: 'エンジニア', dept: '開発', years: 2.2, hue: 240, skills: [['設計', 68], ['品質', 72], ['学習', 91]], trend: [2.9, 3.2, 3.4, 3.6, 3.7, 4.0], comment: '新しい技術を取り入れる速さが強みです。設計の判断理由を言葉にする練習で、任せられる範囲が広がります。' },
]
const DEPTS = ['すべて', '営業', '開発', '管理', 'CS'] as const

const gradOf = (hue: number) => `linear-gradient(135deg, hsl(${hue} 85% 58%), hsl(${(hue + 50) % 360} 85% 62%))`

export default function HrTool() {
  const [dept, setDept] = useState<(typeof DEPTS)[number]>('すべて')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Emp | null>(null)
  const list = useMemo(() => EMPS.filter((e) => (dept === 'すべて' || e.dept === dept) && (q === '' || (e.name + e.role).includes(q))), [dept, q])
  const avg = EMPS.reduce((s, e) => s + e.years, 0) / EMPS.length
  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="hr"
        catchCopy="社員の力を、ひと目で。"
        points={['社員の情報とスキルを一か所に集約', '評価の推移を折れ線で確認', 'AIが評価コメントの下書きを作成']}
        stats={[
          { label: '登録社員', value: 48, unit: '人' },
          { label: 'コメント作成の時間', value: 70, unit: '%減' },
        ]}
      />
      <div className={h.tiles}>
        <StatTile label="社員数（見本）" value={48} unit="人" delta="先月より +2人" />
        <StatTile label="平均在籍" value={avg} decimals={1} unit="年" delta="安定しています" />
        <Glass className={h.ringTile}>
          <Ring value={86} size={72} stroke={8} color="var(--k2)">
            <b className={rs.num}>86%</b>
          </Ring>
          <div>
            <small>評価の提出率</small>
            <p>提出済み 41人 / 48人</p>
          </div>
        </Glass>
      </div>

      <div className={h.bar}>
        <ChipSelect id="hr-dept" options={DEPTS} value={dept} onChange={setDept} />
        <span className={h.search}>
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・役職で探す" aria-label="社員を検索" />
        </span>
      </div>

      <div className={h.main} data-open={sel ? '' : undefined}>
        <motion.ul layout className={h.grid}>
          <AnimatePresence mode="popLayout">
            {list.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              >
                <GlowBorder on={sel?.id === e.id}>
                  <button type="button" className={h.card} data-spot onClick={() => setSel(e)} aria-pressed={sel?.id === e.id}>
                    <span className={h.av} style={{ background: gradOf(e.hue) }}>
                      {e.name[0]}
                    </span>
                    <span className={h.who}>
                      <b>{e.name}</b>
                      <small>{e.role}</small>
                    </span>
                    <Badge tone="muted">{e.dept}</Badge>
                    <span className={h.yrs}>在籍 {e.years}年</span>
                  </button>
                </GlowBorder>
              </motion.li>
            ))}
          </AnimatePresence>
          {list.length === 0 && <li className={h.empty}>該当する社員がいません。条件を変えてみてください。</li>}
        </motion.ul>

        <AnimatePresence mode="wait">
          {sel ? <Detail key={sel.id} emp={sel} onClose={() => setSel(null)} /> : (
            <motion.aside key="none" className={h.placeholder} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <UserRound size={28} />
              <p>社員を選ぶと、スキルと評価の推移がここに出ます。</p>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Detail({ emp, onClose }: { emp: Emp; onClose: () => void }) {
  const [gen, setGen] = useState(0) // 0=未作成 / 1=作成中(表示)
  return (
    <motion.aside className={h.detail} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.3 }}>
      <button type="button" className={h.close} onClick={onClose} aria-label="閉じる">
        <X size={16} />
      </button>
      <div className={h.dHead}>
        <span className={h.avBig} style={{ background: gradOf(emp.hue) }}>
          {emp.name[0]}
        </span>
        <div>
          <b>{emp.name}</b>
          <small>
            {emp.dept} / {emp.role}
          </small>
        </div>
      </div>
      <p className={h.sub}>スキル</p>
      {emp.skills.map(([l, v], i) => (
        <Meter key={emp.id + l} label={l} value={v} i={i} />
      ))}
      <p className={h.sub}>
        評価の推移<small>直近6期</small>
      </p>
      <div className={h.spark} style={{ '--n': emp.trend.length } as CSSProperties}>
        <Sparkline key={emp.id} data={emp.trend} height={64} />
        <span>{emp.trend[0].toFixed(1)}</span>
        <span>{emp.trend[emp.trend.length - 1].toFixed(1)}</span>
      </div>
      <p className={h.sub}>評価コメント</p>
      <div className={h.comment}>
        {gen ? (
          <Typewriter key={`${emp.id}-${gen}`} text={emp.comment} speed={26} />
        ) : (
          <span className={h.mute}>ボタンを押すと、評価コメントの下書きを作ります。</span>
        )}
      </div>
      <RunButton onClick={() => setGen((g) => g + 1)} icon={<Sparkles size={15} />}>
        AIで評価コメントを作る
      </RunButton>
    </motion.aside>
  )
}
