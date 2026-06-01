'use client'

// ドヤくん（公式キャラクター）表示。public/character/{mood}.png を使う。
// 吹き出し(bubble)付きで「一緒に作業している」感を出す。reference/06 §14 準拠。
export default function DoyaChar({
  mood = 'hello',
  size = 72,
  bubble,
  className = '',
  animate = true,
}: {
  mood?: string
  size?: number
  bubble?: string
  className?: string
  animate?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={`/character/${mood}.png`}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        className={`flex-shrink-0 drop-shadow ${animate ? 'doya-float' : ''}`}
      />
      {bubble && (
        <div className="relative bg-white rounded-2xl ring-1 ring-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm">
          {bubble}
        </div>
      )}
      <style jsx>{`
        .doya-float {
          animation: doyaFloat 3s ease-in-out infinite;
        }
        @keyframes doyaFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  )
}
