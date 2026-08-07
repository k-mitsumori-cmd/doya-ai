'use client'

// ============================================
// ドヤ面接官 アバター（ドヤマーケAIのクマ）
// ============================================
// 短いループ動画を状態に応じて切り替えて再生する。
// 生成物は public/mensetsu/avatar/*.mp4（Seedance 2.0 Mini・5秒・1:1）。
// 生成手順は ~/Code/tools/seedance-studio/README_mensetsu.md。
//
// 繋ぎを滑らかにするための作り:
//  1. video要素を2枚持ち、切替時に新しい方を裏で再生開始してからクロスフェードする
//     （1枚だと src 差し替えの瞬間に黒フレームが出る）
//  2. 同じ状態が続く間は、その分類の中から別カットを順に流して単調さを消す
//  3. 動画が無い環境では静止画へ自動フォールバック（生成前でも壊れない）
// ⚠️ 絵文字は使わない（ブランド規約）。

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AvatarProps {
  /** 0..1 の音量。AIが喋っている間だけ動く */
  level: number
  speaking: boolean
  /** 応募者が話している間は「聞いている」表情にする */
  listening: boolean
  name?: string
  /** 冒頭の挨拶・締めの会釈を明示的に出したいとき */
  cue?: 'greet' | 'closing' | null
  /** 丸く切り抜いて表示する（スマホの縦画面向け） */
  circle?: boolean
}

type Mood = 'idle' | 'listening' | 'talking' | 'greet' | 'closing'

const BASE = '/mensetsu/avatar'

/** 状態ごとのカット。同じ状態が続く間は順に巡回させる */
const CLIPS: Record<Mood, string[]> = {
  idle: ['idle_breathe', 'idle_blink', 'idle_look', 'idle_settle'],
  listening: ['listen_nod', 'listen_lean', 'listen_think', 'listen_smile'],
  talking: ['talk_calm', 'talk_gesture', 'talk_point', 'talk_emphasize'],
  greet: ['greet_wave'],
  closing: ['closing_bow'],
}

/** 動画が無いときの静止画フォールバック */
const FALLBACK_IMAGE: Record<Mood, string> = {
  idle: '/character/hello.png',
  listening: '/character/thinking.png',
  talking: '/character/point.png',
  greet: '/character/hello.png',
  closing: '/character/success.png',
}

export default function Avatar({
  level,
  speaking,
  listening,
  name = 'AI面接官',
  cue = null,
  circle = false,
}: AvatarProps) {
  const mood: Mood = cue === 'greet' ? 'greet' : cue === 'closing' ? 'closing' : speaking ? 'talking' : listening ? 'listening' : 'idle'

  // 動画が使えるか。1本でも読めれば動画モードにする。
  const [videoOk, setVideoOk] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`${BASE}/idle_breathe.mp4`, { method: 'HEAD' })
      .then((r) => alive && setVideoOk(r.ok))
      .catch(() => alive && setVideoOk(false))
    return () => {
      alive = false
    }
  }, [])

  // 全カットを先読みしておく。
  // 1本200KB弱・15本で約3MBなので一括で取れる。
  // 読み込みを切替時まで遅らせると、状態が変わった瞬間に一拍固まる。
  useEffect(() => {
    if (videoOk !== true) return
    const all = Object.values(CLIPS).flat()
    const els: HTMLLinkElement[] = []
    for (const slug of all) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'video'
      link.href = `${BASE}/${slug}.mp4`
      document.head.appendChild(link)
      els.push(link)
    }
    return () => els.forEach((el) => el.remove())
  }, [videoOk])

  // 2枚のvideoを交互に使う（A/Bバッファ）
  const [slot, setSlot] = useState(0)
  const [srcs, setSrcs] = useState<[string | null, string | null]>([null, null])
  const idxRef = useRef<Record<Mood, number>>({ idle: 0, listening: 0, talking: 0, greet: 0, closing: 0 })
  const moodRef = useRef<Mood>(mood)
  const videoRefs = [useRef<HTMLVideoElement | null>(null), useRef<HTMLVideoElement | null>(null)]

  /** 次のクリップへ切り替える（裏で再生してからクロスフェード） */
  const swapTo = useCallback(
    (m: Mood) => {
      const list = CLIPS[m]
      const i = idxRef.current[m] % list.length
      idxRef.current[m] = i + 1
      const next = `${BASE}/${list[i]}.mp4`
      const target = slot === 0 ? 1 : 0
      setSrcs((prev) => {
        const copy: [string | null, string | null] = [...prev] as any
        copy[target] = next
        return copy
      })
      // 読み込めたら表に出す。失敗しても現在のカットが流れ続ける。
      const el = videoRefs[target].current
      if (el) {
        const onReady = () => {
          el.removeEventListener('canplay', onReady)
          void el.play().catch(() => {})
          setSlot(target)
        }
        el.addEventListener('canplay', onReady)
        el.load()
      } else {
        setSlot(target)
      }
    },
    // videoRefs は毎レンダリング同一参照なので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slot]
  )

  // 状態が変わったら即切替
  useEffect(() => {
    if (videoOk !== true) return
    if (moodRef.current !== mood || srcs[slot] === null) {
      moodRef.current = mood
      swapTo(mood)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, videoOk])

  // 同じ状態が続く場合、クリップが終わるたびに同分類の別カットへ
  const handleEnded = useCallback(() => {
    if (videoOk !== true) return
    swapTo(moodRef.current)
  }, [swapTo, videoOk])

  // 音量に連動した演出（動画・静止画のどちらでも効かせる）
  const amp = speaking ? Math.min(1, Math.max(0, level * 2.2)) : 0

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {/* 背景の光。話すほど強くなる */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(0,102,255,${0.14 + amp * 0.26}) 0%, rgba(0,102,255,0.05) 40%, rgba(255,255,255,0) 70%)`,
          transition: 'background 120ms linear',
        }}
      />

      <div className="relative flex h-full w-full items-center justify-center" style={{ perspective: '900px' }}>
        <div
          className="relative aspect-square w-[min(78%,460px)]"
          style={{
            transform: `scale(${1 + amp * 0.045})`,
            transition: 'transform 90ms linear',
            filter: speaking
              ? `drop-shadow(0 20px 40px rgba(10,15,60,0.24)) saturate(${1 + amp * 0.2})`
              : 'drop-shadow(0 14px 30px rgba(10,15,60,0.18))',
          }}
        >
          {videoOk === true ? (
            <>
              {[0, 1].map((s) => (
                <video
                  key={s}
                  ref={videoRefs[s]}
                  src={srcs[s] ?? undefined}
                  autoPlay
                  muted
                  playsInline
                  onEnded={s === slot ? handleEnded : undefined}
                  className={`absolute inset-0 h-full w-full object-cover ${circle ? 'rounded-full' : 'rounded-3xl'}`}
                  style={{ opacity: slot === s ? 1 : 0, transition: 'opacity 380ms ease' }}
                />
              ))}
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={FALLBACK_IMAGE[mood]}
              alt=""
              className={`absolute inset-0 h-full w-full select-none object-cover ${circle ? 'rounded-full' : 'rounded-3xl'}`}
              draggable={false}
            />
          )}

          {/* オンライン表示（丸のときだけ。会議アプリの在席ドットに相当） */}
          {circle && (
            <span className="absolute bottom-[6%] right-[6%] z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          )}

          {/* 発話リング。会議アプリの「話しています」枠に相当 */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${circle ? 'rounded-full' : 'rounded-3xl'}`}
            style={{
              boxShadow: speaking
                ? `0 0 0 3px rgba(0,102,255,${0.45 + amp * 0.45}), 0 0 ${24 + amp * 56}px rgba(0,102,255,${0.22 + amp * 0.35})`
                : '0 0 0 1px rgba(10,15,60,0.06)',
              transition: 'box-shadow 90ms linear',
            }}
          />
        </div>
      </div>

      {/* 音量バー（丸表示のときは画面側に波形を出すので省く） */}
      {speaking && !circle && (
        <div aria-hidden className="pointer-events-none absolute bottom-4 flex items-end gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-[#0066ff]"
              style={{
                height: 6 + Math.abs(Math.sin(Date.now() / 180 + i * 0.7)) * (8 + amp * 30),
                opacity: 0.5 + amp * 0.45,
                transition: 'height 80ms linear',
              }}
            />
          ))}
        </div>
      )}

      <span className="sr-only">{name}</span>
    </div>
  )
}
