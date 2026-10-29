'use client'
// 待ち画面の見本。繰り返す動き・進み具合つき（3段階）・作り終わった形を、ブランドの色を変えて並べる
import { useState } from 'react'
import DoyaWorking from '@/components/shell/DoyaWorking'

const STEPS = ['ブースの決まりの色を、壁に乗せています', '見出しを置く場所を空けています', '帯と円の形を整えています', 'もうすぐ、できあがります']
const BRANDS = [
  { name: 'ドヤAI（青）', colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400' } },
  { name: '赤系のブランド', colors: { primary: '#e5484d', secondary: '#1f1414', accent: '#ffd23f' } },
  { name: '緑系のブランド', colors: { primary: '#0e9f6e', secondary: '#0d2620', accent: '#ffcf33' } },
]

export default function WorkingPreview() {
  const [p, setP] = useState(0.4)
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 960 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>繰り返す動き（進み具合が分からないとき）</h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {BRANDS.map((b) => (
          <DoyaWorking key={b.name} title="ドヤくんが画像を作っています" caption="1枚作るのに、30秒ほどかかります。このまま待ってね。" steps={STEPS} colors={b.colors} />
        ))}
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>進み具合つき（まとめて作るとき）</h2>
      <label style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, fontWeight: 700 }}>
        終わった割合 {Math.round(p * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={p} onChange={(e) => setP(Number(e.target.value))} />
      </label>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <DoyaWorking compact title="ドヤくんが面の画像を作っています" caption="できた面から、3Dの壁面に貼られます。" steps={STEPS.slice(0, 3)} colors={BRANDS[0].colors} progress={p} />
        <DoyaWorking compact title="すべての面ができました" colors={BRANDS[1].colors} progress={1} done />
      </div>
    </div>
  )
}
