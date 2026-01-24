#!/usr/bin/env node
/**
 * SEO記事テンプレート用バナー画像生成スクリプト
 * 
 * 使用方法:
 *   node scripts/generate-seo-banners.mjs
 * 
 * 環境変数:
 *   GOOGLE_AI_STUDIO_API_KEY - Google AI Studio APIキー
 *   BASE_URL - APIのベースURL（デフォルト: http://localhost:3000）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// テンプレートデータ（data.tsと同期 - 多様なジャンル）
const articleTemplates = [
  // 棚①：まずはここから（8個）- 初心者向け・入門系
  { id: 'intro-1', title: 'ChatGPTの使い方｜初心者でも5分で始められる完全ガイド', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-2', title: 'Notionの始め方｜タスク管理からメモまで一元化する方法', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-3', title: '副業の始め方｜会社員でもできる月5万円の稼ぎ方', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-4', title: 'プログラミング学習ロードマップ｜未経験から転職までの道のり', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-5', title: '投資信託の選び方｜初心者が失敗しない3つのポイント', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-6', title: 'Webデザインの基本｜センスがなくても作れるコツ', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-7', title: 'マーケティングとは？基礎から実践まで徹底解説', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'intro-8', title: 'リモートワークの始め方｜在宅勤務を快適にする環境づくり', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  
  // 棚②：比較・検討向け（8個）- ツール比較・選び方
  { id: 'compare-1', title: 'プロジェクト管理ツール10選比較｜チーム規模別おすすめ', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-2', title: 'クラウド会計ソフト比較｜freee vs マネーフォワード vs 弥生', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-3', title: '動画編集ソフトおすすめ15選｜無料・有料別に徹底比較', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-4', title: 'オンライン英会話比較｜料金・講師・教材で選ぶベスト10', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-5', title: 'AIライティングツール比較｜ChatGPT vs Claude vs Gemini', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-6', title: 'ノーコードツール比較｜Bubble vs Webflow vs STUDIO', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  { id: 'compare-7', title: 'CRMツール比較｜Salesforce vs HubSpot vs Zoho', phase: '比較', category: '比較型', usage: 'DL誘導向け' },
  { id: 'compare-8', title: 'Web会議ツール比較｜Zoom vs Teams vs Google Meet', phase: '比較', category: '比較型', usage: 'ブログ向け' },
  
  // 棚③：構造タイプ別（7個）- 記事構成パターン
  { id: 'structure-1', title: '【徹底解説】DX推進の進め方｜成功企業に学ぶ7つのステップ', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'structure-2', title: 'スタートアップ資金調達チェックリスト50項目', phase: '認知', category: '一覧型', usage: 'DL誘導向け' },
  { id: 'structure-3', title: '2026年注目のSaaSトレンド20選｜業界別まとめ', phase: '認知', category: '一覧型', usage: 'ブログ向け' },
  { id: 'structure-4', title: 'LP制作の手順｜コンバージョン率を上げる7ステップ', phase: '認知', category: '解説型', usage: 'ブログ向け' },
  { id: 'structure-5', title: 'BtoB営業成功事例10選｜受注率を3倍にした戦略', phase: '認知', category: '解説型', usage: 'DL誘導向け' },
  { id: 'structure-6', title: 'マーケティングオートメーションツールランキングTOP10', phase: '認知', category: '一覧型', usage: 'ブログ向け' },
  { id: 'structure-7', title: 'カスタマーサクセスに関するよくある質問30選', phase: '認知', category: '一覧型', usage: 'ブログ向け' },
  
  // 棚④：鉄板テンプレ（7個）- CV・リード獲得向け
  { id: 'template-1', title: '【完全版】採用ブランディング戦略｜応募数を5倍にする方法', phase: 'CV', category: '解説型', usage: 'LP補助向け' },
  { id: 'template-2', title: 'コンテンツマーケティングの始め方｜成功するメディア運営の全手順', phase: 'CV', category: '比較型', usage: 'DL誘導向け' },
  { id: 'template-3', title: 'ビジネス文書テンプレート集｜すぐに使える書式10選', phase: 'CV', category: '一覧型', usage: 'DL誘導向け' },
  { id: 'template-4', title: 'ECサイトのCVR改善｜売上を2倍にする最適化手法', phase: 'CV', category: '比較型', usage: 'LP補助向け' },
  { id: 'template-5', title: 'データドリブン経営完全ガイド｜意思決定を変える分析手法', phase: 'CV', category: '解説型', usage: 'DL誘導向け' },
  { id: 'template-6', title: 'SNSマーケティング成功事例｜フォロワー10万人達成の軌跡', phase: 'CV', category: '一覧型', usage: 'ブログ向け' },
  { id: 'template-7', title: 'インサイドセールス導入ガイド｜商談数を3倍にする仕組み', phase: 'CV', category: '比較型', usage: 'DL誘導向け' },
]

// 出力ディレクトリ
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'seo-templates')

async function generateBanner(template, retryCount = 0) {
  const maxRetries = 3
  
  try {
    console.log(`\n🎨 Generating banner for: ${template.id}`)
    console.log(`   Title: ${template.title}`)
    
    const response = await fetch(`${BASE_URL}/api/seo/test/banners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: template.id,
        mainTitle: template.title,
        size: '1200x628',
        count: 1,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    
    if (data.success && data.banners && data.banners.length > 0) {
      const imageUrl = data.banners[0]
      
      // Base64データの場合はファイルに保存
      if (imageUrl.startsWith('data:image')) {
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const filePath = path.join(OUTPUT_DIR, `${template.id}.png`)
        
        fs.writeFileSync(filePath, buffer)
        console.log(`   ✅ Saved: ${filePath}`)
        return `/images/seo-templates/${template.id}.png`
      } else {
        // URLの場合はダウンロード
        const imageResponse = await fetch(imageUrl)
        const buffer = Buffer.from(await imageResponse.arrayBuffer())
        const filePath = path.join(OUTPUT_DIR, `${template.id}.png`)
        
        fs.writeFileSync(filePath, buffer)
        console.log(`   ✅ Saved: ${filePath}`)
        return `/images/seo-templates/${template.id}.png`
      }
    } else {
      throw new Error(data.error || 'No banner generated')
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    
    if (retryCount < maxRetries) {
      console.log(`   🔄 Retrying... (${retryCount + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 5000))
      return generateBanner(template, retryCount + 1)
    }
    
    return null
  }
}

async function main() {
  console.log('🚀 SEO Banner Generation Script')
  console.log('================================')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output: ${OUTPUT_DIR}`)
  console.log(`Templates: ${articleTemplates.length}`)
  
  // 出力ディレクトリを作成
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`\n📁 Created output directory: ${OUTPUT_DIR}`)
  }
  
  const results = []
  let successCount = 0
  let failCount = 0
  
  for (let i = 0; i < articleTemplates.length; i++) {
    const template = articleTemplates[i]
    console.log(`\n[${i + 1}/${articleTemplates.length}] Processing ${template.id}...`)
    
    const imageUrl = await generateBanner(template)
    
    if (imageUrl) {
      successCount++
      results.push({ id: template.id, imageUrl, success: true })
    } else {
      failCount++
      results.push({ id: template.id, imageUrl: null, success: false })
    }
    
    // API制限を考慮して待機
    if (i < articleTemplates.length - 1) {
      console.log('   ⏳ Waiting 3 seconds...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  console.log('\n================================')
  console.log('📊 Generation Complete!')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  
  // 結果をJSONファイルに保存
  const resultsPath = path.join(OUTPUT_DIR, 'generation-results.json')
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\n📄 Results saved to: ${resultsPath}`)
  
  // data.tsを更新するためのコードを生成
  console.log('\n📝 Update data.ts with the following imageUrl values:')
  results.filter(r => r.success).forEach(r => {
    console.log(`   ${r.id}: '${r.imageUrl}'`)
  })
}

main().catch(console.error)
