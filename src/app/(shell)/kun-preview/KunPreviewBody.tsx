'use client'
// 開発用: ドヤくんの4つの動き・言葉が1語ずつ濃くなる動き・生成中の帯（LoadingProgress）を並べる
import { useState } from 'react'
import { DoyaKun, type KunAct, type KunPose } from '@/components/ds/kun'
import { RevealWords } from '@/components/ds/motion'
import LoadingProgress from '@/components/LoadingProgress'

const ROWS: { pose: KunPose; act: KunAct; label: string }[] = [
  { pose: 'hello', act: 'idle', label: '入ってくる（idle）' },
  { pose: 'working', act: 'work', label: '作業中（work）' },
  { pose: 'ponder', act: 'think', label: '考え中（think）' },
  { pose: 'success', act: 'cheer', label: 'できた（cheer）' },
]

/** 2026-10-29 に Codex の画像生成で足した新しいポーズ（場面と使い道） */
const NEW_POSES: { pose: KunPose; label: string }[] = [
  { pose: 'mic', label: 'mic（録音）' }, { pose: 'calendar', label: 'calendar（予約）' }, { pose: 'write', label: 'write（作成中）' },
  { pose: 'survey', label: 'survey（アンケート）' }, { pose: 'camera', label: 'camera（写真）' }, { pose: 'search', label: 'search（調査中）' },
  { pose: 'chart', label: 'chart（ダッシュボード）' }, { pose: 'money', label: 'money（金額）' }, { pose: 'clock', label: 'clock（打刻）' },
  { pose: 'handshake', label: 'handshake（商談成立）' }, { pose: 'empty', label: 'empty（空の状態）' },
]

export default function KunPreviewBody() {
  const [round, setRound] = useState(0)
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 64px', display: 'grid', gap: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ドヤくんの動き（開発用の見本）</h1>
      <button type="button" onClick={() => setRound((r) => r + 1)} style={{ justifySelf: 'start', padding: '8px 16px', borderRadius: 999, border: '1px solid #c9d6ea', background: '#fff', fontWeight: 700 }}>もう一度動かす</button>
      <div key={round} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {ROWS.map((r) => (
          <div key={r.act} style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: 16, borderRadius: 16, border: '1px solid #e3eaf5', background: '#fff' }}>
            <DoyaKun pose={r.pose} act={r.act} size={112} say={r.act === 'work' ? '作っています' : undefined} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</span>
          </div>
        ))}
      </div>
      <div key={`n${round}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {NEW_POSES.map((r) => (
          <div key={r.pose} style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: 12, borderRadius: 16, border: '1px solid #e3eaf5', background: '#fff' }}>
            <DoyaKun pose={r.pose} act="idle" size={100} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{r.label}</span>
          </div>
        ))}
      </div>
      <div key={`w${round}`} style={{ padding: 20, borderRadius: 16, border: '1px solid #e3eaf5', background: '#fff' }}>
        <RevealWords as="p" text="ドヤAIが、依頼を読んでいます。ツールと操作を選び、入力の直前まで進めます。" />
      </div>
      <div key={`l${round}`}>
        <LoadingProgress isLoading title="見積書を作成しています" subtitle="品目と税区分を計算して、見積書の形に整えています。" />
      </div>
    </div>
  )
}
