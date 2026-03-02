import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2 } from '@/lib/banner-prompts-v2'

// generateBannersはPOSTでのみ使用するため、動的インポートに変更
// これによりGETリクエスト時のsharpインポートエラーを回避

export const runtime = 'nodejs'
export const maxDuration = 300
// force-dynamic を削除 → Vercel CDN が s-maxage に従いキャッシュする

// V2プロンプトMap（モジュールレベルでキャッシュ — 毎リクエストの動的importを廃止）
type V2PromptInfo = { displayTitle?: string; name: string; fullPrompt: string; genre: string; category: string }
let _v2PromptsMapCache: Map<string, V2PromptInfo> | null = null

function getV2PromptsMap(): Map<string, V2PromptInfo> {
  if (_v2PromptsMapCache) return _v2PromptsMapCache
  _v2PromptsMapCache = new Map()
  try {
    if (Array.isArray(BANNER_PROMPTS_V2)) {
      BANNER_PROMPTS_V2.forEach(p => {
        if (p.id && p.fullPrompt) {
          _v2PromptsMapCache!.set(p.id, {
            displayTitle: p.displayTitle,
            name: p.name,
            fullPrompt: p.fullPrompt,
            genre: p.genre,
            category: p.category,
          })
        }
      })
    }
  } catch (e: any) {
    console.error('[Templates API] Failed to build V2 prompts map:', e.message)
  }
  return _v2PromptsMapCache
}

// 大量のプロンプトパターンを定義（デザイン要素のみ、テキスト内容は反映しない）
export const BANNER_TEMPLATE_PROMPTS = [
  // ビジネス/ブランディング系デザイン（tomorrowgate風）
  {
    id: 'brand-001',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '落ち着いたネイビーとグレーのトーン、タイポグラフィ重視のレイアウト、余白を多く取った洗練されたデザイン、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'brand-002',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: 'ベージュとネイビーの組み合わせ、写真背景に半透明のパネルオーバーレイ、シンプルで上品なタイポグラフィ、信頼感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'brand-003',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '温かいトーンの写真背景、控えめなテキストオーバーレイ、余白を意識したレイアウト、落ち着きのある配色',
    size: '1200x628',
  },
  {
    id: 'brand-004',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: 'ダークネイビー背景、アクセントカラーとしてシアンやグリーンを使用、モダンなタイポグラフィ、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'brand-005',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '白とグレーのミニマルなデザイン、太めのゴシック体タイポグラフィ、シンプルで洗練されたレイアウト、余白多め',
    size: '1200x628',
  },
  {
    id: 'brand-006',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: 'グラデーション背景（ネイビーからダークグレーへ）、中央に配置されたタイポグラフィ、モダンで上品なデザイン',
    size: '1200x628',
  },
  {
    id: 'brand-007',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '写真とタイポグラフィの組み合わせ、左側に大きなテキスト、右側に写真、バランスの取れたレイアウト',
    size: '1200x628',
  },
  {
    id: 'brand-008',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '単色背景（ネイビーまたはグレー）、中央配置のタイポグラフィ、シンプルで力強いデザイン、余白を意識',
    size: '1200x628',
  },
  {
    id: 'brand-009',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '抽象的な幾何学模様の背景、上品な配色（ベージュ、グレー、ネイビー）、タイポグラフィ中心のデザイン',
    size: '1200x628',
  },
  {
    id: 'brand-010',
    industry: 'ビジネス / ブランディング',
    category: 'it',
    prompt: '写真背景にグラデーションフィルター、白または明るい色のタイポグラフィ、読みやすさを重視したデザイン',
    size: '1200x628',
  },
  // UX/デザイン系（goodpatch風）
  {
    id: 'ux-001',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'クリーンでモダンなデザイン、白背景にアクセントカラー、図解やUI要素を配置、ミニマルで洗練されたレイアウト',
    size: '1200x628',
  },
  {
    id: 'ux-002',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'グラデーション背景（明るい色から暗い色へ）、幾何学的な図形や線、モダンなタイポグラフィ、テクノロジー感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'ux-003',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'フローチャートや図解を配置、白背景にアクセントカラー（青、紫、グリーン）、整理されたレイアウト、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'ux-004',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'ダーク背景にネオン系のアクセント、幾何学的なパターン、モダンなUI要素、テクノロジー感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'ux-005',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: '白とグレーのミニマルデザイン、シンプルな図解やアイコン、余白を意識したレイアウト、クリーンで洗練された印象',
    size: '1200x628',
  },
  {
    id: 'ux-006',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'グラデーション背景（パステルカラー）、柔らかい印象の図形やパターン、モダンなタイポグラフィ、親しみやすいデザイン',
    size: '1200x628',
  },
  {
    id: 'ux-007',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'データ可視化の要素（グラフ、チャート）、プロフェッショナルな配色、整理されたレイアウト、信頼感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'ux-008',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: '抽象的なパターンや粒子、ダークトーンにアクセントカラー、モダンで未来的な印象、テクノロジー感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'ux-009',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: 'UI要素やスクリーンショット風の配置、白背景に影やボーダー、モダンなカードデザイン、クリーンで整理された印象',
    size: '1200x628',
  },
  {
    id: 'ux-010',
    industry: 'UX / デザイン / テクノロジー',
    category: 'it',
    prompt: '幾何学的な図形の組み合わせ、シンプルな配色（2-3色）、ミニマルなレイアウト、洗練されたデザイン',
    size: '1200x628',
  },
  // 写真ベースのデザイン
  {
    id: 'photo-001',
    industry: '写真ベース / ビジュアル重視',
    category: 'it',
    prompt: '高品質な写真背景、半透明のオーバーレイ、白または明るい色のタイポグラフィ、写真の美しさを活かしたデザイン',
    size: '1200x628',
  },
  {
    id: 'photo-002',
    industry: '写真ベース / ビジュアル重視',
    category: 'it',
    prompt: '写真背景にグラデーションフィルター、中央または左側にタイポグラフィ、バランスの取れたレイアウト、視覚的に魅力的',
    size: '1200x628',
  },
  {
    id: 'photo-003',
    industry: '写真ベース / ビジュアル重視',
    category: 'it',
    prompt: '写真の一部をトリミング、テキストエリアを確保、読みやすさを重視、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'photo-004',
    industry: '写真ベース / ビジュアル重視',
    category: 'it',
    prompt: '写真背景に暗いオーバーレイ、明るい色のタイポグラフィ、コントラストを意識、視認性を重視したデザイン',
    size: '1200x628',
  },
  {
    id: 'photo-005',
    industry: '写真ベース / ビジュアル重視',
    category: 'it',
    prompt: '写真とタイポグラフィの分割レイアウト、左側に写真、右側にテキスト、バランスの取れたデザイン',
    size: '1200x628',
  },
  // グラデーション・カラー系
  {
    id: 'gradient-001',
    industry: 'グラデーション / カラー重視',
    category: 'it',
    prompt: '鮮やかなグラデーション背景（青から紫へ）、白または黒のタイポグラフィ、モダンでエネルギッシュな印象',
    size: '1200x628',
  },
  {
    id: 'gradient-002',
    industry: 'グラデーション / カラー重視',
    category: 'it',
    prompt: '柔らかいグラデーション（パステルカラー）、上品な配色、ミニマルなタイポグラフィ、優しい印象のデザイン',
    size: '1200x628',
  },
  {
    id: 'gradient-003',
    industry: 'グラデーション / カラー重視',
    category: 'it',
    prompt: 'ダークトーンのグラデーション（ネイビーから黒へ）、アクセントカラーでポイント、モダンで洗練されたデザイン',
    size: '1200x628',
  },
  {
    id: 'gradient-004',
    industry: 'グラデーション / カラー重視',
    category: 'it',
    prompt: '温かいトーンのグラデーション（オレンジからピンクへ）、親しみやすい印象、バランスの取れたレイアウト',
    size: '1200x628',
  },
  {
    id: 'gradient-005',
    industry: 'グラデーション / カラー重視',
    category: 'it',
    prompt: '明るいグラデーション（イエローからオレンジへ）、エネルギッシュな印象、モダンなタイポグラフィ',
    size: '1200x628',
  },
  // ミニマル・シンプル系
  {
    id: 'minimal-001',
    industry: 'ミニマル / シンプル',
    category: 'it',
    prompt: '白背景、シンプルなタイポグラフィ、最小限の要素、余白を意識したレイアウト、クリーンで洗練されたデザイン',
    size: '1200x628',
  },
  {
    id: 'minimal-002',
    industry: 'ミニマル / シンプル',
    category: 'it',
    prompt: '単色背景（グレーまたはベージュ）、中央配置のタイポグラフィ、シンプルで力強いデザイン、余白多め',
    size: '1200x628',
  },
  {
    id: 'minimal-003',
    industry: 'ミニマル / シンプル',
    category: 'it',
    prompt: '白と黒のコントラスト、シンプルな線や図形、ミニマルなレイアウト、洗練されたデザイン',
    size: '1200x628',
  },
  {
    id: 'minimal-004',
    industry: 'ミニマル / シンプル',
    category: 'it',
    prompt: '淡い色の背景、控えめなタイポグラフィ、余白を意識、上品で落ち着いた印象のデザイン',
    size: '1200x628',
  },
  {
    id: 'minimal-005',
    industry: 'ミニマル / シンプル',
    category: 'it',
    prompt: 'グリッドベースのレイアウト、シンプルな配色、整理されたデザイン、プロフェッショナルな印象',
    size: '1200x628',
  },
  // 抽象・パターン系
  {
    id: 'abstract-001',
    industry: '抽象 / パターン',
    category: 'it',
    prompt: '抽象的なパターンや粒子、ダークトーンにアクセントカラー、モダンで未来的な印象、テクノロジー感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'abstract-002',
    industry: '抽象 / パターン',
    category: 'it',
    prompt: '幾何学的なパターンの繰り返し、シンプルな配色、ミニマルなレイアウト、洗練されたデザイン',
    size: '1200x628',
  },
  {
    id: 'abstract-003',
    industry: '抽象 / パターン',
    category: 'it',
    prompt: '流れるような抽象的な形状、グラデーション効果、モダンで動的な印象、エネルギッシュなデザイン',
    size: '1200x628',
  },
  {
    id: 'abstract-004',
    industry: '抽象 / パターン',
    category: 'it',
    prompt: 'ドットや粒子のパターン、ダーク背景に明るいアクセント、テクノロジー感のあるデザイン、未来的な印象',
    size: '1200x628',
  },
  {
    id: 'abstract-005',
    industry: '抽象 / パターン',
    category: 'it',
    prompt: '幾何学的な図形の組み合わせ、シンプルな配色（2-3色）、ミニマルなレイアウト、洗練されたデザイン',
    size: '1200x628',
  },
  // データ可視化・図解系
  {
    id: 'data-001',
    industry: 'データ可視化 / 図解',
    category: 'it',
    prompt: 'データ可視化の要素（グラフ、チャート）、プロフェッショナルな配色、整理されたレイアウト、信頼感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'data-002',
    industry: 'データ可視化 / 図解',
    category: 'it',
    prompt: 'フローチャートや図解を配置、白背景にアクセントカラー（青、紫、グリーン）、整理されたレイアウト、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'data-003',
    industry: 'データ可視化 / 図解',
    category: 'it',
    prompt: 'インフォグラフィック風のデザイン、アイコンや図形を配置、カラフルで視覚的に魅力的、情報が整理された印象',
    size: '1200x628',
  },
  {
    id: 'data-004',
    industry: 'データ可視化 / 図解',
    category: 'it',
    prompt: '図解やUI要素を配置、クリーンでモダンなデザイン、ミニマルで洗練されたレイアウト、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'data-005',
    industry: 'データ可視化 / 図解',
    category: 'it',
    prompt: 'ネットワーク図や接続線、モダンな配色、テクノロジー感のあるデザイン、整理された印象',
    size: '1200x628',
  },
  // UI要素・スクリーンショット系
  {
    id: 'ui-001',
    industry: 'UI要素 / スクリーンショット',
    category: 'it',
    prompt: 'UI要素やスクリーンショット風の配置、白背景に影やボーダー、モダンなカードデザイン、クリーンで整理された印象',
    size: '1200x628',
  },
  {
    id: 'ui-002',
    industry: 'UI要素 / スクリーンショット',
    category: 'it',
    prompt: 'モバイルUIやアプリ画面のモックアップ、現代的で洗練されたデザイン、プロフェッショナルな印象',
    size: '1200x628',
  },
  {
    id: 'ui-003',
    industry: 'UI要素 / スクリーンショット',
    category: 'it',
    prompt: 'ダッシュボードや管理画面風のUI、データビジュアライゼーション、プロフェッショナルで信頼感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'ui-004',
    industry: 'UI要素 / スクリーンショット',
    category: 'it',
    prompt: 'インターフェース要素の配置、グリッドベースのレイアウト、整理されたデザイン、モダンな印象',
    size: '1200x628',
  },
  {
    id: 'ui-005',
    industry: 'UI要素 / スクリーンショット',
    category: 'it',
    prompt: 'ワイヤーフレーム風のデザイン、シンプルな線と図形、ミニマルな配色、クリーンで整理された印象',
    size: '1200x628',
  },
  // 分割レイアウト系
  {
    id: 'split-001',
    industry: '分割レイアウト',
    category: 'it',
    prompt: '写真とタイポグラフィの分割レイアウト、左側に写真、右側にテキスト、バランスの取れたデザイン',
    size: '1200x628',
  },
  {
    id: 'split-002',
    industry: '分割レイアウト',
    category: 'it',
    prompt: '上下分割レイアウト、上部に写真、下部にタイポグラフィ、シンプルで整理されたデザイン',
    size: '1200x628',
  },
  {
    id: 'split-003',
    industry: '分割レイアウト',
    category: 'it',
    prompt: '左右分割、左側にタイポグラフィ、右側にビジュアル要素、バランスの取れたレイアウト',
    size: '1200x628',
  },
  {
    id: 'split-004',
    industry: '分割レイアウト',
    category: 'it',
    prompt: '斜め分割レイアウト、ダイナミックな印象、モダンでエネルギッシュなデザイン',
    size: '1200x628',
  },
  {
    id: 'split-005',
    industry: '分割レイアウト',
    category: 'it',
    prompt: 'グリッド分割、複数のセクション、整理されたレイアウト、プロフェッショナルな印象',
    size: '1200x628',
  },
  // オーバーレイ・フィルター系
  {
    id: 'overlay-001',
    industry: 'オーバーレイ / フィルター',
    category: 'it',
    prompt: '写真背景に暗いオーバーレイ、明るい色のタイポグラフィ、コントラストを意識、視認性を重視したデザイン',
    size: '1200x628',
  },
  {
    id: 'overlay-002',
    industry: 'オーバーレイ / フィルター',
    category: 'it',
    prompt: '写真背景にグラデーションフィルター、白または明るい色のタイポグラフィ、読みやすさを重視したデザイン',
    size: '1200x628',
  },
  {
    id: 'overlay-003',
    industry: 'オーバーレイ / フィルター',
    category: 'it',
    prompt: '写真背景に半透明のパネルオーバーレイ、シンプルで上品なタイポグラフィ、信頼感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'overlay-004',
    industry: 'オーバーレイ / フィルター',
    category: 'it',
    prompt: '写真背景にカラーフィルター、タイポグラフィとのコントラスト、視覚的に魅力的なデザイン',
    size: '1200x628',
  },
  {
    id: 'overlay-005',
    industry: 'オーバーレイ / フィルター',
    category: 'it',
    prompt: '写真背景にぼかしフィルター、前面にタイポグラフィ、フォーカスを意識したデザイン',
    size: '1200x628',
  },
  // ビズリーチ風デザイン（プロフェッショナル・クリーン）
  {
    id: 'bizreach-001',
    industry: 'ビズリーチ風 / プロフェッショナル',
    category: 'it',
    prompt: 'クリーンでプロフェッショナルなデザイン、白背景にアクセントカラー、整理されたレイアウト、信頼感のある印象',
    size: '1200x628',
  },
  {
    id: 'bizreach-002',
    industry: 'ビズリーチ風 / プロフェッショナル',
    category: 'it',
    prompt: 'モダンなタイポグラフィ、余白を意識したレイアウト、シンプルで洗練されたデザイン、ビジネス向けの印象',
    size: '1200x628',
  },
  {
    id: 'bizreach-003',
    industry: 'ビズリーチ風 / プロフェッショナル',
    category: 'it',
    prompt: '図解やUI要素を配置、クリーンで整理されたデザイン、プロフェッショナルな配色、信頼感のある印象',
    size: '1200x628',
  },
  // BANNER LIBRARY風デザイン（多様なスタイル）
  {
    id: 'banner-cute-001',
    industry: 'かわいい / ポップ',
    category: 'beauty',
    prompt: 'かわいいイラスト要素、パステルカラー、柔らかい印象、親しみやすいデザイン、ポップな配色',
    size: '1200x628',
  },
  {
    id: 'banner-cute-002',
    industry: 'かわいい / ポップ',
    category: 'beauty',
    prompt: '丸みを帯びた形状、明るい色使い、楽しい印象、カジュアルなデザイン、親しみやすい配色',
    size: '1200x628',
  },
  {
    id: 'banner-cool-001',
    industry: 'かっこいい / スタイリッシュ',
    category: 'it',
    prompt: 'シャープなデザイン、ダークトーン、アクセントカラー、モダンで洗練された印象、スタイリッシュな配色',
    size: '1200x628',
  },
  {
    id: 'banner-cool-002',
    industry: 'かっこいい / スタイリッシュ',
    category: 'it',
    prompt: '幾何学的な要素、コントラストの強い配色、力強い印象、モダンなデザイン、スタイリッシュなレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-luxury-001',
    industry: '高級感 / きれいめ',
    category: 'beauty',
    prompt: '上品な配色、ゴールドやシルバーのアクセント、エレガントな印象、高級感のあるデザイン、洗練されたレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-luxury-002',
    industry: '高級感 / きれいめ',
    category: 'beauty',
    prompt: 'ミニマルなデザイン、上質な素材感、余白を意識、エレガントなタイポグラフィ、高級感のある印象',
    size: '1200x628',
  },
  {
    id: 'banner-natural-001',
    industry: 'ナチュラル / 爽やか',
    category: 'beauty',
    prompt: '自然な色使い、オーガニックな印象、爽やかな配色、ナチュラルなデザイン、リラックスした印象',
    size: '1200x628',
  },
  {
    id: 'banner-natural-002',
    industry: 'ナチュラル / 爽やか',
    category: 'beauty',
    prompt: 'グリーンやベージュを基調、自然な素材感、清潔感のあるデザイン、爽やかな印象、ナチュラルなレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-casual-001',
    industry: 'カジュアル / 親しみやすい',
    category: 'ec',
    prompt: 'カジュアルなデザイン、親しみやすい配色、リラックスした印象、気軽な感じ、フレンドリーなデザイン',
    size: '1200x628',
  },
  {
    id: 'banner-casual-002',
    industry: 'カジュアル / 親しみやすい',
    category: 'ec',
    prompt: '柔らかい色使い、カジュアルなタイポグラフィ、親しみやすい印象、気軽な感じ、フレンドリーなレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-lively-001',
    industry: 'にぎやか / ポップ',
    category: 'ec',
    prompt: 'カラフルな配色、エネルギッシュな印象、にぎやかなデザイン、ポップな要素、目を引く配色',
    size: '1200x628',
  },
  {
    id: 'banner-lively-002',
    industry: 'にぎやか / ポップ',
    category: 'ec',
    prompt: 'ビビッドな色使い、動的な印象、にぎやかなレイアウト、ポップなデザイン、エネルギッシュな配色',
    size: '1200x628',
  },
  {
    id: 'banner-illustration-001',
    industry: 'イラスト / アート',
    category: 'it',
    prompt: 'イラスト要素を配置、アートな印象、クリエイティブなデザイン、個性的な配色、表現力のあるレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-illustration-002',
    industry: 'イラスト / アート',
    category: 'it',
    prompt: '手描き風のイラスト、温かみのあるデザイン、アートな印象、クリエイティブな配色、表現力のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'banner-photo-001',
    industry: '人物写真 / ポートレート',
    category: 'recruit',
    prompt: '人物写真を配置、信頼感のある印象、プロフェッショナルなデザイン、自然な表情、親しみやすい印象',
    size: '1200x628',
  },
  {
    id: 'banner-photo-002',
    industry: '人物写真 / ポートレート',
    category: 'recruit',
    prompt: 'ポートレート写真、人間味のあるデザイン、信頼感のある印象、自然な表情、親しみやすい配色',
    size: '1200x628',
  },
  {
    id: 'banner-cutout-001',
    industry: '切り抜き / シルエット',
    category: 'ec',
    prompt: '切り抜き要素を配置、シルエット効果、モダンな印象、クリーンなデザイン、視覚的に魅力的',
    size: '1200x628',
  },
  {
    id: 'banner-cutout-002',
    industry: '切り抜き / シルエット',
    category: 'ec',
    prompt: 'シルエットデザイン、切り抜き効果、スタイリッシュな印象、モダンな配色、視覚的に魅力的なレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-japanese-001',
    industry: '和風 / ジャパニーズ',
    category: 'beauty',
    prompt: '和風の要素、伝統的な配色、上品な印象、ジャパニーズなデザイン、洗練されたレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-japanese-002',
    industry: '和風 / ジャパニーズ',
    category: 'beauty',
    prompt: '和のテイスト、伝統的な色使い、上品なデザイン、ジャパニーズな印象、洗練された配色',
    size: '1200x628',
  },
  {
    id: 'banner-neon-001',
    industry: 'ネオン / サイバー',
    category: 'it',
    prompt: 'ネオンカラー、サイバーな印象、未来的なデザイン、エネルギッシュな配色、モダンなレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-neon-002',
    industry: 'ネオン / サイバー',
    category: 'it',
    prompt: 'ネオン効果、ダーク背景、サイバーな印象、未来的なデザイン、エネルギッシュな配色',
    size: '1200x628',
  },
  {
    id: 'banner-retro-001',
    industry: 'レトロ / エスニック',
    category: 'ec',
    prompt: 'レトロな配色、ノスタルジックな印象、ビンテージなデザイン、温かみのある配色、懐かしい感じ',
    size: '1200x628',
  },
  {
    id: 'banner-retro-002',
    industry: 'レトロ / エスニック',
    category: 'ec',
    prompt: 'エスニックな要素、レトロな配色、ノスタルジックな印象、ビンテージなデザイン、温かみのあるレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-typography-001',
    industry: '文字組み / タイポグラフィ',
    category: 'it',
    prompt: 'タイポグラフィ重視、文字組みを意識、シンプルな背景、力強い印象、文字の美しさを活かしたデザイン',
    size: '1200x628',
  },
  {
    id: 'banner-typography-002',
    industry: '文字組み / タイポグラフィ',
    category: 'it',
    prompt: '文字だけのデザイン、タイポグラフィ中心、シンプルな配色、力強い印象、文字の美しさを活かしたレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-sale-001',
    industry: 'セール / キャンペーン',
    category: 'ec',
    prompt: 'セール感のあるデザイン、目を引く配色、ビビッドな色使い、エネルギッシュな印象、キャンペーン感のあるレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-sale-002',
    industry: 'セール / キャンペーン',
    category: 'ec',
    prompt: 'セールバッジ、目を引くデザイン、ビビッドな配色、エネルギッシュな印象、キャンペーン感のあるデザイン',
    size: '1200x628',
  },
  {
    id: 'banner-seasonal-001',
    industry: '季節感 / イベント',
    category: 'ec',
    prompt: '季節感のある配色、イベント感のあるデザイン、温かみのある印象、季節を感じさせるレイアウト',
    size: '1200x628',
  },
  {
    id: 'banner-seasonal-002',
    industry: '季節感 / イベント',
    category: 'ec',
    prompt: '季節の要素、イベント感のある配色、温かみのあるデザイン、季節を感じさせる印象、イベント感のあるレイアウト',
    size: '1200x628',
  },
]

// さらにバリエーションを追加（デザインパターンの組み合わせ）
export const generateMoreVariations = () => {
  const variations: typeof BANNER_TEMPLATE_PROMPTS = []
  
  // デザインパターンの組み合わせ
  const colorSchemes = [
    'ネイビーとグレーの組み合わせ',
    'ベージュとネイビーの組み合わせ',
    '白とグレーのミニマル',
    'ダークネイビー背景にアクセントカラー',
    'グラデーション背景（ネイビーからダークグレー）',
    '温かいトーンのグラデーション',
    '鮮やかなグラデーション（青から紫）',
    '柔らかいパステルカラー',
    'ダークトーンにネオン系アクセント',
    '単色背景（グレーまたはベージュ）',
    'パステルカラーの組み合わせ',
    'ビビッドな色使い',
    'ゴールドやシルバーのアクセント',
    '自然な色使い（グリーン、ベージュ）',
    'カラフルな配色',
    'ネオンカラー',
    'レトロな配色',
    '和風の伝統的な配色',
  ]
  
  const layoutStyles = [
    'タイポグラフィ重視のレイアウト',
    '写真背景に半透明のパネルオーバーレイ',
    '中央配置のタイポグラフィ',
    '左側に大きなテキスト、右側に写真',
    '余白を多く取った洗練されたデザイン',
    'シンプルで上品なタイポグラフィ',
    '図解やUI要素を配置',
    '幾何学的な図形やパターン',
    'フローチャートや図解を配置',
    'ミニマルなレイアウト',
    'イラスト要素を配置',
    '人物写真を配置',
    '切り抜き要素を配置',
    '文字だけのデザイン',
    'セールバッジやキャンペーン要素',
    '季節感のある要素',
    '和風の要素',
    'ネオン効果',
  ]
  
  const designMoods = [
    'プロフェッショナルな印象',
    '信頼感のあるデザイン',
    'モダンで洗練されたデザイン',
    'クリーンで整理された印象',
    '上品で落ち着いた印象',
    'テクノロジー感のあるデザイン',
    '親しみやすいデザイン',
    'エネルギッシュな印象',
    '優しい印象のデザイン',
    '力強いデザイン',
    'かわいい印象',
    'かっこいい印象',
    '高級感のある印象',
    'ナチュラルで爽やかな印象',
    'カジュアルな印象',
    'にぎやかでポップな印象',
    'アートな印象',
    '未来的な印象',
    'ノスタルジックな印象',
    'エレガントな印象',
  ]

  const industries = [
    'ビジネス / ブランディング',
    'UX / デザイン / テクノロジー',
    '写真ベース / ビジュアル重視',
    'グラデーション / カラー重視',
    'ミニマル / シンプル',
    'Web / IT / スクール / 教育',
    '転職・採用・人材',
    'SaaS / BtoBサービス',
    'かわいい / ポップ',
    'かっこいい / スタイリッシュ',
    '高級感 / きれいめ',
    'ナチュラル / 爽やか',
    'カジュアル / 親しみやすい',
    'にぎやか / ポップ',
    'イラスト / アート',
    '人物写真 / ポートレート',
    '切り抜き / シルエット',
    '和風 / ジャパニーズ',
    'ネオン / サイバー',
    'レトロ / エスニック',
    '文字組み / タイポグラフィ',
    'セール / キャンペーン',
    '季節感 / イベント',
  ]
  
  const categories = ['it', 'it', 'it', 'it', 'it', 'it', 'recruit', 'it', 'beauty', 'it', 'beauty', 'beauty', 'ec', 'ec', 'it', 'recruit', 'ec', 'beauty', 'it', 'ec', 'it', 'ec', 'ec']

  // 200個のバリエーションを生成（合計400個以上）
  for (let i = 0; i < 200; i++) {
    const colorIndex = i % colorSchemes.length
    const layoutIndex = Math.floor(i / colorSchemes.length) % layoutStyles.length
    const moodIndex = i % designMoods.length
    const industryIndex = i % industries.length
    
    variations.push({
      id: `template-${String(i + 50).padStart(3, '0')}`,
      industry: industries[industryIndex],
      category: categories[industryIndex],
      prompt: `${colorSchemes[colorIndex]}、${layoutStyles[layoutIndex]}、${designMoods[moodIndex]}`,
      size: '1200x628',
    })
  }
  
  return variations
}

// GET: テンプレート一覧を取得（DBから画像URLを取得）
// 最適化: 必要最小限のフィールドのみ返す

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const minimal = searchParams.get('minimal') === 'true'

    // DBから既存のテンプレート情報を取得（isActive=true かつ画像あり のみ）
    let dbTemplates: any[] = []
    let dbError: string | null = null
    try {
      dbTemplates = await prisma.bannerTemplate.findMany({
        where: {
          isActive: true,
          imageUrl: {
            not: null,
          },
          NOT: {
            imageUrl: {
              contains: 'placehold.co',
            },
          },
        },
        select: {
          templateId: true,
          isFeatured: true,
          industry: true,
          category: true,
          updatedAt: true,
          ...(minimal ? {} : { prompt: true }),
        },
        take: limit,
        skip: offset,
        orderBy: { isFeatured: 'desc' },
      })

      console.log(`[Templates API] Fetched ${dbTemplates.length} active templates in ${Date.now() - startTime}ms`)
    } catch (err: any) {
      console.error('[Templates API] Database error:', err.message)
      dbError = err.message
    }

    // DBエラーの場合はキャッシュなしでエラーを返す（V2プロンプトにフォールバックしない）
    if (dbError) {
      const errorResponse = NextResponse.json({
        templates: [],
        featuredTemplateId: null,
        count: 0,
        generatedCount: 0,
        loadTime: Date.now() - startTime,
        error: 'データベースに一時的に接続できません。数秒後にリロードしてください。',
        dbError: true,
      }, { status: 503 })
      errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return errorResponse
    }
    
    // V2プロンプトMap（モジュールレベルでキャッシュ済み）
    const v2PromptsMap = getV2PromptsMap()

    // DB上で画像生成済みのテンプレートIDセット
    const generatedIds = new Set(dbTemplates.map((t) => t.templateId))

    // DBテンプレートをV2プロンプト情報と結合して返す（生成済み）
    const readyTemplates = dbTemplates.map((t) => {
      const cacheBuster = t.updatedAt ? `?v=${new Date(t.updatedAt).getTime()}` : ''
      const imageApiUrl = `/api/banner/test/image/${t.templateId}${cacheBuster}`
      const v2Prompt = v2PromptsMap.get(t.templateId)
      const fullPrompt = v2Prompt?.fullPrompt || t.prompt || ''

      const baseTemplate = {
        id: t.templateId,
        industry: v2Prompt?.genre || t.industry,
        category: v2Prompt?.category || t.category,
        imageUrl: imageApiUrl,
        isFeatured: t.isFeatured || false,
        displayTitle: v2Prompt?.displayTitle || v2Prompt?.name || '',
        name: v2Prompt?.name || '',
        isPending: false,
      }

      if (!minimal) {
        return {
          ...baseTemplate,
          prompt: fullPrompt,
          previewUrl: imageApiUrl,
          size: '1200x628',
          hasGeneratedImage: true,
        }
      }

      return baseTemplate
    })

    // 生成済みテンプレートのみ返す（未生成は非表示）
    const templates = readyTemplates

    const featuredTemplate = dbTemplates.find((t) => t.isFeatured) || dbTemplates[0]
    const featuredTemplateId = featuredTemplate?.templateId || readyTemplates[0]?.id || null

    const totalAvailable = v2PromptsMap.size

    const response = NextResponse.json({
      templates,
      featuredTemplateId,
      count: templates.length,
      generatedCount: dbTemplates.length,
      totalAvailable,
      pendingCount: totalAvailable - dbTemplates.length,
      loadTime: Date.now() - startTime,
    })

    // ?fresh=1 の場合はCDNキャッシュをバイパス（ポーリング用）
    const fresh = searchParams.get('fresh') === '1'
    if (fresh) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    } else {
      response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
    }

    return response
  } catch (err: any) {
    console.error('[Templates API] Get templates error:', err.message)
    const errorResponse = NextResponse.json(
      { error: err.message || '取得に失敗しました', dbError: true },
      { status: 500 }
    )
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return errorResponse
  }
}

// POST: テンプレートのバナーを生成（初期データ生成用）
export async function POST(request: NextRequest) {
  try {
    // 動的インポート（sharpの初期化エラーを回避）
    const { generateBanners } = await import('@/lib/nanobanner')
    
    const body = await request.json()
    const { templateIds, generateAll = false } = body

    const templatesToGenerate = generateAll
      ? [...BANNER_TEMPLATE_PROMPTS, ...generateMoreVariations()]
      : BANNER_TEMPLATE_PROMPTS.filter((t) => templateIds?.includes(t.id))

    const results = []

    for (const template of templatesToGenerate) {
      try {
        const [width, height] = template.size.split('x')
        const result = await generateBanners(
          template.category as any,
          template.prompt,
          template.size,
          {
            headlineText: template.prompt.split(' - ')[0] || template.prompt,
            customImagePrompt: template.prompt,
            variationMode: 'diverse',
          },
          1
        )

        if (result.banners && result.banners.length > 0) {
          results.push({
            templateId: template.id,
            imageUrl: result.banners[0],
            prompt: template.prompt,
            industry: template.industry,
            category: template.category,
            size: template.size,
          })
        }
      } catch (err: any) {
        console.error(`Template ${template.id} generation failed:`, err)
        // エラーでも続行
      }
    }

    return NextResponse.json({
      generated: results,
      count: results.length,
    })
  } catch (err: any) {
    console.error('Generate templates error:', err)
    return NextResponse.json({ error: err.message || '生成に失敗しました' }, { status: 500 })
  }
}
