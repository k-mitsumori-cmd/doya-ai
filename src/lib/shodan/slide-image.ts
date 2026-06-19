// ============================================
// ドヤ商談準備 提案スライドの画像生成（ドヤスライド方式を流用）
// 既存の slidesJson(構成テキスト) を1枚絵のスライド画像へ。gpt-image-2（composeSlideImage）。
// 生成画像は shodan 非公開バケットへ保存し、配信は署名URL（機密性確保）。
// ============================================
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'
import { raceTimeout } from '@/lib/fetch-timeout'
import { uploadPng } from './storage'
import type { ProposalSlide } from './types'

// DBに保存する形（imagePath は非公開バケット内パス。失敗時 null）
export interface StoredSlide {
  title: string
  imagePath: string | null
  role?: string
}
// クライアントに返す形（署名URL）
export interface SlideImage {
  title: string
  imageUrl: string | null
  role?: string
}

export interface SlideBrand {
  brandColors?: string[]
  logoUrl?: string | null
}

function shodanProject(prepId: string, brand?: SlideBrand): ComposeProject {
  const theme = brand?.brandColors?.find((c) => /^#[0-9a-fA-F]{6}$/.test(c)) || '#7f19e6'
  return {
    id: `shodan-${prepId}`,
    aspectRatio: 'wide', // 16:9
    themeColor: theme, // 自社ブランドカラーをスライドの基調色に
    stylePreset: 'corporate',
    logoUrl: brand?.logoUrl || null, // 自社ロゴをセーフゾーンへ合成
    logoPosition: 'top-right',
    logoSize: 'M',
    logoBackingChip: true,
  }
}
function roleFromType(t?: string): string {
  if (t === 'cover') return '表紙'
  if (t === 'agenda') return '目次'
  if (t === 'closing') return 'まとめ'
  return ''
}
// 本文スライドが全部同じ見た目にならないよう、スライドごとに異なる図解レイアウトの方向性を与える。
// （doyaslideの本文テンプレートは「Visual directionの図解で本文を構成してよい」と明記されているため効く）
const BODY_LAYOUTS = [
  '左右2カラムの対比レイアウト（左に「現状・課題」、右に「あるべき姿/解決後」、中央に矢印）。',
  '左から右への3〜4ステップのプロセスフロー図（各ステップをカード＋矢印で接続）。',
  '3〜4枚のカードを横並びにした並列レイアウト（各カード: アイコン＋小見出し＋短い説明）。',
  '中央に主役の数値/KPIを特大表示し、周囲に根拠・補足を配置するダッシュボード風。',
  '2×2のマトリクス（または比較表）で整理する構成。',
  '横軸タイムラインで段階・スケジュール・ロードマップを表現する構成。',
  '上部に結論を大きく、その下に根拠を3点の図解カードで支える構成。',
]

function visualPromptFor(slide: ProposalSlide, index: number): string {
  const bullets = (slide.bullets || []).join(' / ')
  const t = slide.type
  if (t === 'cover') {
    return `プロのビジネス提案スライドの表紙。大きなタイトル「${slide.title}」と一言サブタイトル${slide.subtitle ? `「${slide.subtitle}」` : ''}。余白を活かしたミニマルで信頼感のある構成。`
  }
  if (t === 'agenda') {
    return `提案資料の目次（アジェンダ）。番号付きリストで各章を整然と並べる。見出し:「${slide.title}」。`
  }
  if (t === 'closing') {
    return `提案のまとめ/次のステップ。結論を簡潔に示し、行動喚起(CTA)を1つ。見出し:「${slide.title}」。`
  }
  // 本文(content)はスライドごとに別レイアウトを割り当てて単調さを回避
  const layout = BODY_LAYOUTS[index % BODY_LAYOUTS.length]
  return [
    'プロのビジネス提案スライド（1枚絵）。',
    `主役の見出し: 「${slide.title}」。`,
    slide.subtitle ? `補足: ${slide.subtitle}。` : '',
    `本文の図解レイアウトの方向性（必ずこの構図で本文を構成）: ${layout}`,
    bullets ? `この構図に落とし込む要点: ${bullets}。` : '',
    'クリーンで信頼感のある企業デザイン。余白を活かし、文字は大きく可読性高く。',
  ].filter(Boolean).join('')
}

/** 1スライドを画像生成し、shodan非公開バケットへ保存してパスを返す */
export async function generateSlideImage(
  userId: string,
  prepId: string,
  slide: ProposalSlide,
  index: number,
  opts?: { extra?: string; brand?: SlideBrand }
): Promise<StoredSlide> {
  const role = roleFromType(slide.type)
  const res = await composeSlideImage(
    userId,
    shodanProject(prepId, opts?.brand),
    {
      index: index + 1,
      role: role || null,
      headline: slide.title,
      subText: (slide.bullets || []).join('\n') || slide.subtitle || null,
      visualPrompt: visualPromptFor(slide, index),
    },
    opts?.extra
  )
  // 生成結果（doyaslideの公開URL）を取得し、shodan非公開バケットへ再保存（各I/Oはタイムアウトで保護＝ハング防止）
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 25000)
  let buf: Buffer
  try {
    const resp = await fetch(res.imageUrl, { signal: ctrl.signal })
    if (!resp.ok) throw new Error('生成画像の取得に失敗しました')
    buf = Buffer.from(await resp.arrayBuffer())
  } finally {
    clearTimeout(to)
  }
  const path = `shodan/slides/${prepId}/${index}-${Date.now()}.png`
  await raceTimeout('uploadSlide', 25000, uploadPng(path, buf))
  return { title: slide.title, imagePath: path, role }
}
