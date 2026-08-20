import type { Step } from './sections'
import { DoyaKun, type Mood } from './DoyaKun'

function splitLabel(label: string) {
  if (label.length <= 13) return [label]
  const midpoint = Math.ceil(label.length / 2)
  const candidates = ['、', 'して', 'から', 'を', 'と']
  const cut = candidates.map((token) => label.indexOf(token, Math.max(2, midpoint - 5)) + (token === '、' ? 1 : 0)).find((index) => index > 2 && index < label.length - 2) || midpoint
  return [label.slice(0, cut), label.slice(cut)]
}

export function ServiceFlowDiagram({ serviceName, steps, accent = '#00e0ff', mood = 'point' }: { serviceName: string; steps: Step[]; accent?: string; mood?: Mood }) {
  const count = Math.min(4, steps.length)
  const cardWidth = count === 4 ? 190 : 240
  const gap = count === 4 ? 54 : 76
  const total = cardWidth * count + gap * (count - 1)
  const start = (1080 - total) / 2
  return (
    <figure className="relative mb-10 overflow-hidden rounded-[2rem] border border-blue-100 bg-white px-4 py-7 shadow-sm" aria-label={`${serviceName}の利用フロー`}>
      <svg viewBox="0 0 1080 300" role="img" className="h-auto w-full" aria-label={`${serviceName}の入力から出力までの流れ`}>
        <defs>
          <linearGradient id={`${serviceName}-flow-gradient`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#0066ff" /><stop offset="1" stopColor={accent} />
          </linearGradient>
          <filter id={`${serviceName}-flow-shadow`}><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#0066ff" floodOpacity=".12" /></filter>
        </defs>
        <rect x="0" y="0" width="1080" height="300" rx="28" fill="#f7faff" />
        <circle cx="970" cy="38" r="120" fill={accent} opacity=".08" />
        {steps.slice(0, count).map((step, index) => {
          const x = start + index * (cardWidth + gap)
          const lines = splitLabel(step.title)
          return <g key={step.title}>
            {index < count - 1 && <g aria-hidden="true"><line x1={x + cardWidth + 12} y1="150" x2={x + cardWidth + gap - 18} y2="150" stroke="#0066ff" strokeWidth="5" strokeLinecap="round" /><path d={`M ${x + cardWidth + gap - 28} 138 L ${x + cardWidth + gap - 14} 150 L ${x + cardWidth + gap - 28} 162`} fill="none" stroke="#0066ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></g>}
            <rect x={x} y="58" width={cardWidth} height="184" rx="24" fill="white" stroke="#dbeafe" strokeWidth="2" filter={`url(#${serviceName}-flow-shadow)`} />
            <circle cx={x + 38} cy="96" r="22" fill={`url(#${serviceName}-flow-gradient)`} />
            <text x={x + 38} y="103" textAnchor="middle" fill="white" fontSize="20" fontWeight="900">{index + 1}</text>
            <text x={x + cardWidth / 2} y={lines.length === 1 ? 174 : 160} textAnchor="middle" fill="#0f172a" fontSize={count === 4 ? 16 : 18} fontWeight="900">
              {lines.map((line, lineIndex) => <tspan key={line} x={x + cardWidth / 2} dy={lineIndex === 0 ? 0 : 28}>{line}</tspan>)}
            </text>
          </g>
        })}
      </svg>
      <DoyaKun mood={mood} size={68} float={false} className="absolute right-3 top-2 hidden sm:block" />
    </figure>
  )
}
