'use client'

// ============================================
// ドヤ面接官 音声波形
// ============================================
// スマホの縦画面では丸いアバターの下に波形を置く。
// 「いま声が出ている／こちらの番だ」が一目で分かるようにするためで、
// 実際の周波数解析ではなく音量に追従する見た目上の表現。

export interface WaveformProps {
  /** 0..1 の音量 */
  level: number
  /** AIが話している */
  speaking: boolean
  /** 応募者が話している */
  listening: boolean
  bars?: number
}

export default function Waveform({ level, speaking, listening, bars = 28 }: WaveformProps) {
  const active = speaking || listening
  const amp = active ? Math.min(1, Math.max(0, level * 2.2)) : 0
  const color = speaking ? '#0066ff' : listening ? '#10b981' : '#cfd8e8'

  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        // 中央ほど高くする（声の塊に見せる）。動きは位相をずらして自然にする。
        const center = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2)
        const wobble = Math.abs(Math.sin(i * 0.9 + Date.now() / 140))
        const h = active ? 4 + center * (6 + amp * 30) * (0.45 + wobble * 0.55) : 3
        return (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: h,
              backgroundColor: color,
              opacity: active ? 0.45 + amp * 0.5 : 0.35,
              transition: 'height 90ms linear, background-color 200ms linear',
            }}
          />
        )
      })}
    </div>
  )
}
