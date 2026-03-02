/**
 * 記事テンプレート用バナー生成スクリプト
 * 
 * 使用方法:
 * npx tsx src/app/seo/template/generate-banners.ts
 */

import { articleTemplates } from './data'
import { generateBanners } from '@/lib/nanobanner'

// 記事タイプに基づいてカテゴリをマッピング
function getCategoryFromTemplate(template: typeof articleTemplates[0]): string {
  if (template.category === 'howto' || template.category === 'case') {
    return 'marketing'
  }
  if (template.category === 'compare' || template.articleType === 'comparison' || template.articleType === 'ranking') {
    return 'it'
  }
  return 'it'
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
  if (template.category === 'guide') {
    descriptions.push('解説・ガイド記事の雰囲気、知識を伝えるクリーンなデザイン')
  } else if (template.category === 'compare') {
    descriptions.push('比較・検討記事の雰囲気、複数の選択肢を整理したビジュアル')
  } else if (template.category === 'howto') {
    descriptions.push('実践的なHowTo記事の雰囲気、ステップバイステップのビジュアル')
  } else if (template.category === 'case') {
    descriptions.push('事例・トレンド記事の雰囲気、データと実績を伝えるビジュアル')
  }

  // 記事タイプに基づく説明
  if (template.articleType === 'explanation') {
    descriptions.push('初心者にもわかりやすい、親しみやすいデザイン')
  } else if (template.articleType === 'comparison' || template.articleType === 'ranking') {
    descriptions.push('比較検討をサポートする、信頼感のあるデザイン')
  } else if (template.articleType === 'howto') {
    descriptions.push('手順を追って実践できる、行動を促すデザイン')
  } else if (template.articleType === 'case') {
    descriptions.push('実績・成功事例を伝える、説得力のあるデザイン')
  }

  return descriptions.join('、')
}

// 記事タイプに応じたブランドカラーを取得
function getBrandColors(template: typeof articleTemplates[0]): string[] {
  if (template.category === 'guide') {
    return ['#2563EB', '#3B82F6'] // ブルー系
  } else if (template.category === 'compare') {
    return ['#F59E0B', '#F97316'] // オレンジ系
  } else if (template.category === 'howto') {
    return ['#10B981', '#059669'] // グリーン系
  } else if (template.category === 'case') {
    return ['#8B5CF6', '#A855F7'] // パープル系
  }
  return ['#2563EB', '#6366F1']
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
