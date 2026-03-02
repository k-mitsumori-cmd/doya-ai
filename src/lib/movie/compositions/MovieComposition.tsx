'use client'
// ============================================
// ドヤムービーAI - メインRemotionコンポジション
// ============================================
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import type { CompositionConfig, SceneData, TextOverlay } from '../types'

// ---- テキストアニメーション ----

function AnimatedText({ text, animation, delay, style }: {
  text: string
  animation: TextOverlay['animation']
  delay: number
  style: React.CSSProperties
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const delayFrames = delay * fps

  if (frame < delayFrames) return null

  const progress = interpolate(frame - delayFrames, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  let animStyle: React.CSSProperties = {}

  switch (animation) {
    case 'fade-in':
      animStyle = { opacity: progress }
      break
    case 'slide-up':
      animStyle = {
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
      }
      break
    case 'zoom-in':
      animStyle = {
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [0.7, 1])})`,
      }
      break
    case 'typewriter': {
      const visibleChars = Math.floor(interpolate(frame - delayFrames, [0, fps * 1.5], [0, text.length], { extrapolateRight: 'clamp' }))
      return (
        <div style={{ ...style, ...animStyle }}>
          {text.slice(0, visibleChars)}
          {visibleChars < text.length && <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>}
        </div>
      )
    }
    case 'none':
    default:
      animStyle = { opacity: 1 }
  }

  return <div style={{ ...style, ...animStyle }}>{text}</div>
}

// ---- 背景 ----

function SceneBackground({ scene }: { scene: SceneData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (scene.bgType === 'image' && scene.bgValue) {
    let transform = 'scale(1)'
    if (scene.bgAnimation === 'ken-burns') {
      const scale = interpolate(frame, [0, fps * scene.duration], [1, 1.1], { extrapolateRight: 'clamp' })
      const x = interpolate(frame, [0, fps * scene.duration], [0, -3], { extrapolateRight: 'clamp' })
      transform = `scale(${scale}) translateX(${x}%)`
    } else if (scene.bgAnimation === 'zoom-in') {
      const scale = interpolate(frame, [0, fps * scene.duration], [1, 1.15], { extrapolateRight: 'clamp' })
      transform = `scale(${scale})`
    }
    return (
      <AbsoluteFill
        style={{
          backgroundImage: `url(${scene.bgValue})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform,
        }}
      />
    )
  }

  if (scene.bgType === 'gradient' && scene.bgValue) {
    // CSS linear-gradient文字列はそのまま使用。
    // 旧来のTailwindクラス名（後方互換）はマッピングで変換。
    const tailwindMap: Record<string, string> = {
      'from-blue-600 to-indigo-700': 'linear-gradient(135deg, #2563eb, #4338ca)',
      'from-rose-500 to-pink-500': 'linear-gradient(135deg, #f43f5e, #ec4899)',
      'from-slate-900 to-blue-900': 'linear-gradient(135deg, #0f172a, #1e3a5f)',
      'from-gray-900 to-slate-800': 'linear-gradient(135deg, #111827, #1e293b)',
      'from-emerald-600 to-teal-700': 'linear-gradient(135deg, #059669, #0f766e)',
      'from-amber-600 via-amber-700 to-orange-800': 'linear-gradient(135deg, #d97706, #b45309, #9a3412)',
      'from-indigo-600 to-purple-600': 'linear-gradient(135deg, #4f46e5, #9333ea)',
      'from-sky-600 to-blue-700': 'linear-gradient(135deg, #0284c7, #1d4ed8)',
      'from-blue-900 to-slate-900': 'linear-gradient(135deg, #1e3a8a, #0f172a)',
      'from-rose-600 to-pink-600': 'linear-gradient(135deg, #e11d48, #db2777)',
      'from-orange-500 to-red-500': 'linear-gradient(135deg, #f97316, #ef4444)',
      'from-amber-500 to-orange-500': 'linear-gradient(135deg, #f59e0b, #f97316)',
      'from-amber-900 to-red-900': 'linear-gradient(135deg, #78350f, #7f1d1d)',
      'from-slate-700 to-gray-800': 'linear-gradient(135deg, #334155, #1f2937)',
      'from-blue-800 to-indigo-900': 'linear-gradient(135deg, #1e40af, #312e81)',
      'from-blue-700 to-indigo-800': 'linear-gradient(135deg, #1d4ed8, #3730a3)',
    }
    // CSS gradient文字列はそのまま使用、Tailwindクラス名は変換
    const gradient = tailwindMap[scene.bgValue] ?? scene.bgValue
    return <AbsoluteFill style={{ background: gradient }} />
  }

  if (scene.bgType === 'color' && scene.bgValue) {
    return <AbsoluteFill style={{ backgroundColor: scene.bgValue }} />
  }

  return <AbsoluteFill style={{ backgroundColor: '#1e293b' }} />
}

// ---- 透かし（Free プランのみ） ----

function Watermark() {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        fontSize: 14, color: 'rgba(255,255,255,0.5)',
        fontFamily: 'sans-serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}>
        ドヤムービーAI
      </div>
    </AbsoluteFill>
  )
}

// ---- シーン ----

function MovieScene({ scene, width, height }: { scene: SceneData; width: number; height: number }) {
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      {(scene.texts ?? []).map((text, i) => (
        <AnimatedText
          key={i}
          text={text.content}
          animation={text.animation}
          delay={text.delay}
          style={{
            position: 'absolute',
            left: `${text.x}%`,
            top: `${text.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: text.fontSize,
            fontFamily: text.fontFamily,
            color: text.color,
            textAlign: (text.align ?? 'center') as 'left' | 'center' | 'right',
            width: '90%',
            maxWidth: width * 0.9,
            lineHeight: 1.4,
            fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            whiteSpace: 'pre-wrap',
          }}
        />
      ))}
    </AbsoluteFill>
  )
}

// ---- メインコンポジション ----

export function MovieComposition({ config }: { config: CompositionConfig }) {
  const { fps, width, height } = useVideoConfig()
  let cumulativeFrames = 0

  return (
    <AbsoluteFill>
      {config.scenes.map((scene, i) => {
        const startFrame = cumulativeFrames
        const durationFrames = Math.round(scene.duration * fps)
        cumulativeFrames += durationFrames

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <MovieScene scene={scene} width={width} height={height} />
          </Sequence>
        )
      })}
      {config.watermark && <Watermark />}
    </AbsoluteFill>
  )
}
