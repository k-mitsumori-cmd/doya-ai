'use client'

// ============================================
// ドヤ面接官 アバター（ドヤマーケAIのクマ）
// ============================================
// ブランドのマスコット（白クマ）をそのまま面接官として立てる。
// 状態でポーズを切り替え、AIの音声の音量エンベロープで
// 拡大・傾き・発光を動かして「喋っている」感を出す。
//
// ⚠️ 差し替え可能な設計にしてある:
//    public/mensetsu/avatar/{idle,talking,listening}.mp4 を置くと
//    自動で動画ループ再生に切り替わる（静止画はフォールバック）。
//    将来 Seedance / HeyGen 等で生成したループに差し替えるための口。
// ⚠️ 絵文字は使わない（ブランド規約）。

import { useEffect, useMemo, useRef, useState } from 'react'

export interface AvatarProps {
  /** 0..1 の音量。AIが喋っている間だけ動く */
  level: number
  speaking: boolean
  /** 応募者が話している間は「聞いている」表情にする */
  listening: boolean
  name?: string
  /** 動画ループを使う（public/mensetsu/avatar/*.mp4 が存在する場合のみ true にする） */
  useVideo?: boolean
}

type Pose = 'idle' | 'talking' | 'listening'

/** ポーズ → マスコット画像。既存の /public/character を流用する */
const POSE_IMAGE: Record<Pose, string> = {
  idle: '/character/hello.png',
  talking: '/character/point.png',
  listening: '/character/thinking.png',
}

const POSE_VIDEO: Record<Pose, string> = {
  idle: '/mensetsu/avatar/idle.mp4',
  talking: '/mensetsu/avatar/talking.mp4',
  listening: '/mensetsu/avatar/listening.mp4',
}

export default function Avatar({ level, speaking, listening, name = 'AI面接官', useVideo = false }: AvatarProps) {
  const [bob, setBob] = useState(0)
  const rafRef = useRef<number | null>(null)
  const tRef = useRef(0)

  const pose: Pose = speaking ? 'talking' : listening ? 'listening' : 'idle'

  // ゆっくりした呼吸・浮遊。話している間は速く大きく。
  useEffect(() => {
    const tick = () => {
      tRef.current += speaking ? 0.09 : 0.028
      setBob(Math.sin(tRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [speaking])

  // 音量を滑らかに反映（生の値は跳ねるので上限を掛ける）
  const amp = useMemo(() => (speaking ? Math.min(1, Math.max(0, level * 2.2)) : 0), [level, speaking])

  const scale = 1 + amp * 0.075 + (speaking ? 0.012 : 0.004) * bob
  const rotY = (speaking ? 5.5 : 2.2) * bob + (listening ? -3 : 0)
  const rotX = (speaking ? -3.2 : -1.1) * bob
  const translateY = (speaking ? -7 : -4) * bob - amp * 5

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* 背景の光。話すほど強くなる */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(0,102,255,${0.16 + amp * 0.3}) 0%, rgba(0,102,255,0.06) 38%, rgba(255,255,255,0) 68%)`,
          transition: 'background 120ms linear',
        }}
      />

      {/* 発話リング。Zoomの「話しています」枠の役割も兼ねる */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: `${46 + amp * 16}%`,
          aspectRatio: '1 / 1',
          border: `3px solid rgba(0,102,255,${speaking ? 0.35 + amp * 0.5 : 0.12})`,
          boxShadow: speaking
            ? `0 0 ${28 + amp * 70}px rgba(0,102,255,${0.3 + amp * 0.45}), inset 0 0 ${20 + amp * 40}px rgba(0,224,255,0.22)`
            : '0 0 18px rgba(0,102,255,0.12)',
          transition: 'width 90ms linear, box-shadow 90ms linear, border-color 90ms linear',
        }}
      />
      {/* 外側にもう一枚、音量で波打つ輪 */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: `${58 + amp * 26}%`,
          aspectRatio: '1 / 1',
          border: `2px solid rgba(0,224,255,${speaking ? 0.1 + amp * 0.3 : 0.05})`,
          transition: 'width 140ms ease-out, border-color 140ms linear',
        }}
      />

      {/* キャラクター本体（3D） */}
      <div className="relative" style={{ perspective: '900px', width: '78%', maxWidth: 460 }}>
        <div
          style={{
            transform: `translateY(${translateY}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`,
            transformStyle: 'preserve-3d',
            transition: 'transform 70ms linear',
            filter: speaking
              ? `drop-shadow(0 22px 44px rgba(10,15,60,0.28)) saturate(${1 + amp * 0.35}) brightness(${1 + amp * 0.06})`
              : 'drop-shadow(0 16px 32px rgba(10,15,60,0.2))',
          }}
        >
          {useVideo ? (
            <video
              key={pose}
              src={POSE_VIDEO[pose]}
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-3xl"
            />
          ) : (
            // ポーズ切替はクロスフェード（パッと入れ替わると安っぽく見える）
            (['idle', 'talking', 'listening'] as Pose[]).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p}
                src={POSE_IMAGE[p]}
                alt=""
                className="w-full select-none rounded-3xl"
                style={{
                  opacity: pose === p ? 1 : 0,
                  transition: 'opacity 260ms ease',
                  position: p === 'idle' ? 'relative' : 'absolute',
                  inset: p === 'idle' ? undefined : 0,
                }}
                draggable={false}
              />
            ))
          )}
        </div>

        {/* 足元の影。浮遊に合わせて伸縮させると立体に見える */}
        <div
          aria-hidden
          className="mx-auto rounded-[50%] bg-[#0a0f3c]"
          style={{
            width: `${52 - bob * 3 - amp * 4}%`,
            height: 14,
            marginTop: -6,
            filter: 'blur(10px)',
            opacity: 0.16 + amp * 0.05,
            transition: 'width 70ms linear',
          }}
        />
      </div>

      {/* 音量バー。喋っているのが一目で分かる */}
      {speaking && (
        <div aria-hidden className="pointer-events-none absolute bottom-4 flex items-end gap-1">
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 6 + Math.abs(Math.sin(tRef.current * 1.5 + i * 0.7)) * (8 + amp * 34)
            return (
              <span
                key={i}
                className="w-1.5 rounded-full bg-[#0066ff]"
                style={{ height: h, opacity: 0.55 + amp * 0.4, transition: 'height 70ms linear' }}
              />
            )
          })}
        </div>
      )}

      <span className="sr-only">{name}</span>
    </div>
  )
}
