// グラフィック割付：ブースのどの面に、どの高さで、何を描くかを決めるルール
// 展示会装飾の定石（上段は遠くから読む、中段は立ち止まった人が読む、下段は什器に隠れる）をそのままルール化している。

import type { BoothElement, BoothPlan, SiteAnalysis } from './engine'

export type Face = 'front' | 'side'

export interface GraphicZone {
  label: string
  fromMm: number // 床からの高さ（下端）
  toMm: number // 床からの高さ（上端）
  content: string
  tone: 'primary' | 'secondary' | 'light' | 'muted'
}

export interface GraphicPanel {
  id: string
  elementId: string
  face: Face
  name: string
  offsetMm: number // 部材の左端からの位置（横方向）
  widthMm: number
  heightMm: number
  baseMm: number // パネル下端の床からの高さ
  viewDistanceM: number
  role: string
  visual: string // どんな画像を描くか
  headline: string
  zones: GraphicZone[]
  material: string
}

const mm = (m: number) => Math.round(m * 1000)

// 背面壁を約2mのモジュールに割り、中央にロゴとキャッチ、左右に訴求点を置く
function backwallPanels(e: BoothElement, a: SiteAnalysis): GraphicPanel[] {
  const total = mm(e.w)
  const n = Math.max(1, Math.round(total / 2000))
  const w = Math.floor(total / n)
  const center = Math.floor((n - 1) / 2)
  return Array.from({ length: n }).map((_, i) => {
    const isHero = i === center
    const vp = a.valueProps[(i > center ? i - 1 : i) % a.valueProps.length]
    return {
      id: `${e.id}-p${i + 1}`,
      elementId: e.id,
      face: 'front' as Face,
      name: isHero ? `背面壁 中央（${i + 1}/${n}）` : `背面壁 ${i < center ? '左' : '右'}（${i + 1}/${n}）`,
      offsetMm: i * w,
      widthMm: i === n - 1 ? total - i * w : w,
      heightMm: mm(e.h),
      baseMm: 0,
      viewDistanceM: isHero ? 15 : 5,
      role: isHero ? '通路の15m先から「何の会社か」を伝える' : '近づいた人に、具体的な強みを1つだけ伝える',
      visual: isHero
        ? `${a.brand}のロゴとキャッチコピーを大きく。背景はブランドカラーの大胆なグラデーション。人物写真は使わず、製品画面のシルエットを薄く重ねる`
        : `「${vp.title}」を象徴する製品画面のイメージ（ノートPCまたはスマホに表示された画面）。余白を広く取り、見出しは短く`,
      headline: isHero ? a.headline.replace('\n', '') : vp.title,
      zones: isHero
        ? [
            { label: '上段', fromMm: 1800, toMm: mm(e.h), content: `ロゴ「${a.brand}」とキャッチコピー（文字高 250mm 以上）`, tone: 'primary' },
            { label: '中段', fromMm: 900, toMm: 1800, content: a.subline, tone: 'light' },
            { label: '下段', fromMm: 0, toMm: 900, content: '什器や人で隠れるため、色面のみ（文字を置かない）', tone: 'muted' },
          ]
        : [
            { label: '上段', fromMm: 1800, toMm: mm(e.h), content: `見出し「${vp.title}」（文字高 150mm 以上）`, tone: 'secondary' },
            { label: '中段', fromMm: 900, toMm: 1800, content: `${vp.body}。製品画面のイメージ`, tone: 'light' },
            { label: '下段', fromMm: 0, toMm: 900, content: '色面のみ。床置きのパンフレットスタンドを想定', tone: 'muted' },
          ],
      material: 'ファブリック（布）出力・テンションフレーム',
    }
  })
}

function panelFor(e: BoothElement, a: SiteAnalysis): GraphicPanel[] {
  switch (e.kind) {
    case 'wall':
      if (e.w > e.d) return backwallPanels(e, a)
      return [
        {
          id: `${e.id}-p1`,
          elementId: e.id,
          face: 'side',
          name: '側面壁',
          offsetMm: 0,
          widthMm: mm(e.d),
          heightMm: mm(e.h),
          baseMm: 0,
          viewDistanceM: 3,
          role: 'ブース内で立ち止まった人に、導入効果の数字で納得してもらう',
          visual: '導入効果を示す大きな数字と、簡単な棒グラフのインフォグラフィック。顧客ロゴは実在のものを描かず枠だけ',
          headline: '導入効果',
          zones: [
            { label: '上段', fromMm: 1800, toMm: mm(e.h), content: '見出し「導入企業の声」', tone: 'secondary' },
            { label: '中段', fromMm: 900, toMm: 1800, content: '効果の数字3つ（作業時間・コスト・成果）', tone: 'light' },
            { label: '下段', fromMm: 0, toMm: 900, content: '資料ダウンロードのQRコード', tone: 'muted' },
          ],
          material: 'ターポリン出力・パネル貼り',
        },
      ]
    case 'counter':
      return [
        {
          id: `${e.id}-p1`,
          elementId: e.id,
          face: 'front',
          name: '受付カウンター前面',
          offsetMm: 0,
          widthMm: mm(e.w),
          heightMm: mm(e.h),
          baseMm: 0,
          viewDistanceM: 2,
          role: '名刺交換の動機を作る',
          visual: `ブランドカラー一色の面に${a.brand}のロゴと「名刺交換でノベルティを進呈」の案内。シンプルに`,
          headline: '名刺交換でノベルティ進呈',
          zones: [
            { label: '上段', fromMm: 600, toMm: mm(e.h), content: `ロゴ「${a.brand}」と案内文`, tone: 'primary' },
            { label: '下段', fromMm: 0, toMm: 600, content: '足元で汚れやすいため濃い色面', tone: 'secondary' },
          ],
          material: '粘着シート出力・カウンター腰壁貼り',
        },
      ]
    case 'rollup':
      return [
        {
          id: `${e.id}-p1`,
          elementId: e.id,
          face: 'front',
          name: 'ロールアップバナー',
          offsetMm: 0,
          widthMm: mm(e.w),
          heightMm: mm(e.h),
          baseMm: 0,
          viewDistanceM: 8,
          role: '通路を歩く人の足を止める',
          visual: `縦長の構図。上部に「${a.valueProps[0].title}」、中央に製品画面、下部にQRコード`,
          headline: a.valueProps[0].title,
          zones: [
            { label: '上段', fromMm: 1400, toMm: mm(e.h), content: `キャッチ「${a.valueProps[0].title}」`, tone: 'primary' },
            { label: '中段', fromMm: 600, toMm: 1400, content: '製品画面のイメージ', tone: 'light' },
            { label: '下段', fromMm: 0, toMm: 600, content: 'QRコードとロゴ', tone: 'secondary' },
          ],
          material: 'ターポリン出力・ロールアップスタンド',
        },
      ]
    case 'sign':
      return [
        {
          id: `${e.id}-p1`,
          elementId: e.id,
          face: 'front',
          name: '吊り看板',
          offsetMm: 0,
          widthMm: mm(e.w),
          heightMm: mm(e.h),
          baseMm: mm(e.z ?? 0),
          viewDistanceM: 30,
          role: 'ホールの遠くからブースの場所を知らせる',
          visual: `白地に${a.brand}のロゴのみ。四面とも同じデザイン`,
          headline: a.brand,
          zones: [{ label: '全面', fromMm: 0, toMm: mm(e.h), content: `ロゴ「${a.brand}」のみ`, tone: 'primary' }],
          material: 'ファブリック出力・トラス吊り',
        },
      ]
    case 'storage':
      return [
        {
          id: `${e.id}-p1`,
          elementId: e.id,
          face: 'front',
          name: 'ストックルーム扉面',
          offsetMm: 0,
          widthMm: mm(e.w),
          heightMm: mm(e.h),
          baseMm: 0,
          viewDistanceM: 4,
          role: '裏方の扉も広告面として使う',
          visual: 'ブランドカラーのパターン（ロゴの形を繰り返し並べた柄）',
          headline: '',
          zones: [{ label: '全面', fromMm: 0, toMm: mm(e.h), content: 'ロゴの繰り返しパターン', tone: 'secondary' }],
          material: '粘着シート出力',
        },
      ]
    default:
      return []
  }
}

export function generateGraphicPlan(plan: BoothPlan, a: SiteAnalysis): GraphicPanel[] {
  return plan.elements.flatMap((e) => panelFor(e, a))
}

export function buildPanelPrompt(p: GraphicPanel, a: SiteAnalysis) {
  return [
    `展示会ブースの「${p.name}」に貼る装飾グラフィックの入稿デザイン。仕上がりサイズ 幅${p.widthMm.toLocaleString()}mm × 高さ${p.heightMm.toLocaleString()}mm。`,
    `役割：${p.role}（想定視認距離 ${p.viewDistanceM}m）。`,
    `描く内容：${p.visual}。`,
    '高さごとの割付：',
    ...p.zones.map((z) => `・${z.label}（床から${z.fromMm}〜${z.toMm}mm）：${z.content}`),
    `ブランドカラー：メイン ${a.colors.primary}、サブ ${a.colors.secondary}、アクセント ${a.colors.accent}。トーンは「${a.tone}」。`,
    '日本語は正確に、太いゴシック体で。絵文字・実在しないロゴや認証マークは描かない。平面のデザインデータとして、写真のような斜めのアングルにはしない。',
  ].join('\n')
}
