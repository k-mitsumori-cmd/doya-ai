'use client'

// ============================================
// ドヤ面接官 2Dアバター（案A: 自前実装）
// ============================================
// AIの音声出力の音量エンベロープで口の開き具合を動かし、一定間隔で瞬きさせる。
// 外部SDK・月額費用ゼロ。将来 HeyGen 等へ差し替えられるよう、
// 「音量(0..1)と発話中フラグを受け取って描画するだけ」の責務に閉じている。
// ⚠️ 絵文字は使わない（ブランド規約）。すべてSVGで描く。

import { useEffect, useRef, useState } from 'react'

export interface AvatarProps {
  /** 0..1 の音量。AIが喋っている間だけ動く */
  level: number
  speaking: boolean
  /** 応募者が話している間は「聞いている」表情にする */
  listening: boolean
  name?: string
}

export default function Avatar({ level, speaking, listening, name = 'AI面接官' }: AvatarProps) {
  const [blink, setBlink] = useState(false)
  const [nod, setNod] = useState(0)
  const nodTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 瞬き（2.4〜6秒間隔でランダム）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true)
        setTimeout(() => setBlink(false), 130)
        schedule()
      }, 2400 + Math.random() * 3600)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  // 応募者が話し始めたら軽くうなずく（相槌の代わり）
  useEffect(() => {
    if (!listening) return
    if (nodTimer.current) clearTimeout(nodTimer.current)
    nodTimer.current = setTimeout(() => {
      setNod(1)
      setTimeout(() => setNod(0), 420)
    }, 900)
    return () => {
      if (nodTimer.current) clearTimeout(nodTimer.current)
    }
  }, [listening])

  // 口の開き: 音量に追従。閉じすぎ・開きすぎを抑える
  const openness = speaking ? Math.min(1, Math.max(0.06, level * 1.8)) : 0.04
  const mouthRy = 3 + openness * 15
  const mouthRx = 17 - openness * 3

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <svg
        viewBox="0 0 240 260"
        className="h-full max-h-[420px] w-auto"
        style={{
          transform: `translateY(${nod * 6}px)`,
          transition: 'transform 220ms ease-out',
        }}
        role="img"
        aria-label={`${name}のアバター`}
      >
        <defs>
          <linearGradient id="mensetsuBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f0ff" />
            <stop offset="100%" stopColor="#d3e3ff" />
          </linearGradient>
          <linearGradient id="mensetsuSuit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2f5c" />
            <stop offset="100%" stopColor="#141d3a" />
          </linearGradient>
        </defs>

        {/* 背景の円 */}
        <circle cx="120" cy="118" r="96" fill="url(#mensetsuBg)" />

        {/* 肩・スーツ */}
        <path d="M40 260 C46 206 82 186 120 186 C158 186 194 206 200 260 Z" fill="url(#mensetsuSuit)" />
        {/* 襟 */}
        <path d="M104 188 L120 214 L136 188 L128 184 L120 198 L112 184 Z" fill="#f5f8ff" />
        {/* ネクタイ（ブランドカラー） */}
        <path d="M120 214 L127 226 L120 258 L113 226 Z" fill="#0066ff" />

        {/* 首 */}
        <rect x="107" y="160" width="26" height="30" rx="12" fill="#f0c9a8" />

        {/* 頭 */}
        <ellipse cx="120" cy="118" rx="54" ry="60" fill="#f7d7ba" />
        {/* 髪 */}
        <path
          d="M66 112 C66 74 92 56 120 56 C148 56 174 74 174 112 C174 96 156 86 120 86 C84 86 66 96 66 112 Z"
          fill="#2a2f3d"
        />

        {/* 目 */}
        {blink ? (
          <>
            <path d="M92 118 q10 6 20 0" stroke="#2a2f3d" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M128 118 q10 6 20 0" stroke="#2a2f3d" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="102" cy="118" rx="6" ry="7.5" fill="#2a2f3d" />
            <ellipse cx="138" cy="118" rx="6" ry="7.5" fill="#2a2f3d" />
            <circle cx="104" cy="115.5" r="2" fill="#ffffff" />
            <circle cx="140" cy="115.5" r="2" fill="#ffffff" />
          </>
        )}

        {/* 眉（聞いているときは少し上げる） */}
        <path
          d={`M92 ${listening ? 100 : 104} q10 -5 20 0`}
          stroke="#2a2f3d"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M128 ${listening ? 100 : 104} q10 -5 20 0`}
          stroke="#2a2f3d"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* 鼻 */}
        <path d="M120 126 l-4 12 h8 z" fill="#e8bd9a" />

        {/* 口: 音量で開閉 */}
        <ellipse cx="120" cy="154" rx={mouthRx} ry={mouthRy} fill="#8c4a3f" />
        {openness > 0.35 && <ellipse cx="120" cy={154 + mouthRy * 0.42} rx={mouthRx * 0.62} ry={mouthRy * 0.34} fill="#e2736b" />}
      </svg>

      <div className="mt-3 flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 shadow-sm">
        <span
          className={`inline-block h-2 w-2 rounded-full ${speaking ? 'bg-[#0066ff]' : listening ? 'bg-emerald-500' : 'bg-slate-300'}`}
        />
        <span className="text-sm font-bold text-[#0a0f3c]">{name}</span>
        <span className="text-xs font-medium text-[#425071]">
          {speaking ? '話しています' : listening ? '聞いています' : '待機中'}
        </span>
      </div>
    </div>
  )
}
