/**
 * 記事テンプレート用バナー生成スクリプト
 * 
 * 使用方法:
 * npx tsx src/app/seo/test/generate-banners.ts
 */

import { articleTemplates } from './data'
import { generateBanners } from '@/lib/nanobanner'

// 記事タイプに基づいてカテゴリをマッピング
function getCategoryFromTemplate(template: { phase: string; category: string; usage: string }): string {
  // 記事の性質に基づいてカテゴリを決定
  if (template.phase === 'CV' || template.usage === 'LP補助向け' || template.usage === 'DL誘導向け') {
    return 'marketing' // マーケティング向け
  }
  if (template.category === '比較型' || template.phase === '比較') {
    return 'it' // IT・ツール比較
  }
  return 'it' // デフォルトはIT
}

// 記事タイトルからバナープロンプト用のキーワードを抽出
function extractKeyword(title: string): string {
  // 「｜」で分割して最初の部分を取得
  const mainPart = title.split('｜')[0].trim()
  return mainPart || title
}

// 記事テンプレートごとにバナーを生成
async function generateBannerForTemplate(template: typeof articleTemplates[0], index: number) {
  console.log(`\n[${index + 1}/${articleTemplates.length}] Generating banner for: ${template.title}`)
  
  const category = getCategoryFromTemplate(template)
  const keyword = extractKeyword(template.title)
  const size = '1200x628' // 記事バナー用の標準サイズ
  
  try {
    // ドヤバナーAIのプロンプト構造を参考に、記事バナー用のプロンプトを生成
    const result = await generateBanners(
      category,
      keyword,
      size,
      {
        purpose: 'article_banner', // 記事バナー用
        headlineText: template.title,
        // 記事の性質に応じたビジュアル説明
        imageDescription: getImageDescription(template),
        // 記事タイプに応じた配色
        brandColors: getBrandColors(template),
      },
      1 // 1枚のみ生成
    )
    
    if (result.banners && result.banners.length > 0 && !result.banners[0].startsWith('https://placehold')) {
      console.log(`✅ Success: ${template.id}`)
      return {
        id: template.id,
        imageUrl: result.banners[0],
      }
    } else {
      console.error(`❌ Failed: ${template.id} - ${result.error || 'Unknown error'}`)
      return {
        id: template.id,
        imageUrl: null,
        error: result.error,
      }
    }
  } catch (error: any) {
    console.error(`❌ Error generating banner for ${template.id}:`, error.message)
    return {
      id: template.id,
      imageUrl: null,
      error: error.message,
    }
  }
}

// 記事の性質に応じたビジュアル説明を生成
function getImageDescription(template: typeof articleTemplates[0]): string {
  const descriptions: string[] = []
  
  // カテゴリに基づく説明
  if (template.category === '解説型') {
    descriptions.push('解説・ガイド記事の雰囲気、知識を伝えるクリーンなデザイン')
  } else if (template.category === '比較型') {
    descriptions.push('比較・検討記事の雰囲気、複数の選択肢を整理したビジュアル')
  } else if (template.category === '一覧型') {
    descriptions.push('一覧・まとめ記事の雰囲気、情報を整理したグリッド・リスト表現')
  }
  
  // フェーズに基づく説明
  if (template.phase === '認知') {
    descriptions.push('初心者にもわかりやすい、親しみやすいデザイン')
  } else if (template.phase === '比較') {
    descriptions.push('比較検討をサポートする、信頼感のあるデザイン')
  } else if (template.phase === 'CV') {
    descriptions.push('コンバージョンを意識した、行動を促すデザイン')
  }
  
  // 用途に基づく説明
  if (template.usage === 'ブログ向け') {
    descriptions.push('ブログ記事用の読みやすい、情報重視のデザイン')
  } else if (template.usage === 'DL誘導向け') {
    descriptions.push('ダウンロード誘導を意識した、価値を伝えるデザイン')
  } else if (template.usage === 'LP補助向け') {
    descriptions.push('ランディングページ補助用の、コンバージョン重視のデザイン')
  }
  
  return descriptions.join('、')
}

// 記事タイプに応じたブランドカラーを取得
function getBrandColors(template: typeof articleTemplates[0]): string[] {
  // フェーズに基づく配色
  if (template.phase === '認知') {
    return ['#2563EB', '#3B82F6'] // ブルー系
  } else if (template.phase === '比較') {
    return ['#F59E0B', '#F97316'] // オレンジ系
  } else if (template.phase === 'CV') {
    return ['#10B981', '#059669'] // グリーン系
  }
  
  // デフォルト
  return ['#2563EB', '#6366F1'] // ブルー・インディゴ系
}

// メイン処理
async function main() {
  console.log('🚀 Starting banner generation for article templates...')
  console.log(`Total templates: ${articleTemplates.length}`)
  
  const results: Array<{ id: string; imageUrl: string | null; error?: string }> = []
  
  // 順次生成（API制限を考慮）
  for (let i = 0; i < articleTemplates.length; i++) {
    const result = await generateBannerForTemplate(articleTemplates[i], i)
    results.push(result)
    
    // API制限を考慮して少し待機
    if (i < articleTemplates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒待機
    }
  }
  
  // 結果を出力
  console.log('\n📊 Generation Results:')
  const successCount = results.filter(r => r.imageUrl).length
  const failCount = results.filter(r => !r.imageUrl).length
  
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  
  // 成功した結果をJSON形式で出力（data.tsに反映用）
  const successResults = results.filter(r => r.imageUrl)
  console.log('\n📝 Success results (copy to data.ts):')
  console.log(JSON.stringify(successResults, null, 2))
  
  // 失敗した結果も出力
  if (failCount > 0) {
    console.log('\n⚠️ Failed templates:')
    results.filter(r => !r.imageUrl).forEach(r => {
      console.log(`  - ${r.id}: ${r.error || 'Unknown error'}`)
    })
  }
}

// スクリプトとして実行
if (require.main === module) {
  main().catch(console.error)
}

export { generateBannerForTemplate, getCategoryFromTemplate, extractKeyword }
