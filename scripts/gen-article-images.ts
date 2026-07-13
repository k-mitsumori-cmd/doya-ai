// ドヤマーケ記事用のサムネ・図解画像を統一ディスパッチャで生成する単発スクリプト
// 実行: npx tsx scripts/gen-article-images.ts
// 出力: ~/doyamarke-content/images/<slug>/*.png
import { loadEnv } from './_env'
loadEnv()

import fs from 'fs'
import path from 'path'
import os from 'os'

const OUT_ROOT = path.join(os.homedir(), 'doyamarke-content', 'images')
const CHAR_PATH = path.join(
  os.homedir(),
  'Library/CloudStorage/GoogleDrive-k-mitsumori@surisuta.jp/マイドライブ/01_事業管理/04_ドヤマーケ/01_ロゴ/ドヤマーケ_logo_png/ドヤピイ:キャラクター.png'
)

const STYLE = 'フラットなベクターイラスト、白背景、メインカラーは青(#0066ff)系、クリーンなBtoBメディアのアイキャッチ。画像内に長い文章は入れない。'
// 本来はキャラ素材を入力画像で渡す（nano-banana経由）が、GOOGLE_GENAI_API_KEYが無効のため
// 暫定でテキスト描写によるgpt-image-2生成に切り替え。キー更新後は入力画像方式に戻すこと。
const CHAR_NOTE = 'マスコットキャラクター「ドヤピィ」を登場させる: 茶色くて丸い体の可愛いフクロウ。白いパーカーを着ていて胸に青い棒グラフのプリント、頭に青いAIヘッドセット（片耳にAIの文字）を装着。大きな丸い黒目、オレンジのくちばし、明るく賢い表情。2〜3頭身のちびキャラ。'

interface Spec {
  slug: string
  file: string
  size: string
  useChar: boolean
  prompt: string
}

const SPECS: Spec[] = [
  {
    slug: 'llmo-seo-guide', file: 'thumb.png', size: '1600x896', useChar: true,
    prompt: `${CHAR_NOTE} ドヤピィが大きなチェックリストのボードを指差して案内している構図。ボードには青いチェックマークが10個並ぶ。背景にChatGPT風の吹き出しと検索窓のモチーフ。「LLMO対策」という日本語テキストを上部に大きく1箇所だけ。${STYLE}`,
  },
  {
    slug: 'aio-llmo-tools-comparison', file: 'thumb.png', size: '1600x896', useChar: true,
    prompt: `${CHAR_NOTE} ドヤピィが計測ダッシュボード（レーダーチャートと棒グラフ）の前でタブレットを持って解説している構図。ダッシュボードには4つのAIエンジンを表す4色のアイコン枠。「AIOツール比較」という日本語テキストを上部に大きく1箇所だけ。${STYLE}`,
  },
  {
    slug: 'chatgpt-company-not-mentioned', file: 'thumb.png', size: '1600x896', useChar: true,
    prompt: `${CHAR_NOTE} チャットAIの回答画面のイラスト。回答リストに3社分のカードが並ぶが1枠だけ「？」で空欄になっており、ドヤピィが驚いた表情でその空欄を指差している構図。「自社が出てこない？」という日本語テキストを上部に1箇所だけ。${STYLE}`,
  },
  {
    slug: 'chatgpt-gemini-comparison-2026', file: 'thumb.png', size: '1600x896', useChar: true,
    prompt: `${CHAR_NOTE} 左右対決構図。左に緑っぽい渦巻きモチーフのAIアイコン、右に青い星型モチーフのAIアイコン（どちらも実在ロゴは使わない抽象アイコン）、中央でドヤピィが天秤を持って審判をしている。「徹底比較」という日本語テキストを上部に1箇所だけ。${STYLE}`,
  },
  {
    slug: 'claude-report-writing-guide', file: 'thumb.png', size: '1600x896', useChar: true,
    prompt: `${CHAR_NOTE} ドヤピィがノートPCの前でレポート文書（グラフ入りのA4書類）を完成させて親指を立てている構図。書類から光が出ている演出。「レポート作成」という日本語テキストを上部に1箇所だけ。${STYLE}`,
  },
  {
    slug: 'llmo-seo-guide', file: 'fig-4steps.png', size: '1216x832', useChar: false,
    prompt: `横並び4ステップのフローチャート図解。左から「診断」「整備」「共起」「観測」の4つの日本語ラベル付きの丸いアイコンが矢印でつながる。アイコンは虫眼鏡・書類・リンク・グラフ。${STYLE}`,
  },
  {
    slug: 'aio-llmo-tools-comparison', file: 'fig-flowchart.png', size: '1216x832', useChar: false,
    prompt: `縦型の選定フローチャート図解。「日本語で計測したい？」「複数AIエンジン対応が必要？」「継続できる価格？」という3つの日本語の分岐ボックスがYes/No矢印でつながるシンプルな図。${STYLE}`,
  },
]

async function main() {
  const { generateImageWithFallback } = await import('../src/lib/image-generator')

  let charInput: { mimeType: string; base64: string }[] | undefined
  if (fs.existsSync(CHAR_PATH)) {
    charInput = [{ mimeType: 'image/png', base64: fs.readFileSync(CHAR_PATH).toString('base64') }]
    console.log('キャラ素材読込OK:', CHAR_PATH)
  } else {
    console.warn('⚠ キャラ素材が見つかりません。キャラなしで生成します')
  }

  for (const spec of SPECS) {
    const dir = path.join(OUT_ROOT, spec.slug)
    fs.mkdirSync(dir, { recursive: true })
    const outPath = path.join(dir, spec.file)
    if (fs.existsSync(outPath)) {
      console.log(`skip（既存）: ${spec.slug}/${spec.file}`)
      continue
    }
    console.log(`生成中: ${spec.slug}/${spec.file} ...`)
    try {
      const result = await generateImageWithFallback({
        prompt: spec.prompt,
        size: spec.size,
        quality: 'medium',
        inputImages: undefined, // Geminiキー無効のため暫定でテキスト描写方式
      })
      fs.writeFileSync(outPath, Buffer.from(result.base64, 'base64'))
      console.log(`OK: ${outPath} (model=${result.model}${result.fallbackUsed ? ', fallback' : ''})`)
    } catch (e: any) {
      console.error(`NG: ${spec.slug}/${spec.file}:`, e?.message || e)
    }
  }
  console.log('完了')
}

main().catch((e) => { console.error(e); process.exit(1) })
