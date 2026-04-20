#!/usr/bin/env node

/**
 * バッチ生成の進捗を確認するスクリプト
 * 
 * 使用方法:
 *   node scripts/check-bootstrap-progress.mjs
 * 
 * または、定期的に確認:
 *   watch -n 30 node scripts/check-bootstrap-progress.mjs
 */

import fs from 'fs'
import path from 'path'

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', '.bootstrap-progress.json')

async function fetchJson(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.json()
  } catch (error) {
    return null
  }
}

function loadProgress() {
  try {
    if (!fs.existsSync(PROGRESS_PATH)) return null
    const raw = fs.readFileSync(PROGRESS_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}時間${minutes}分${secs}秒`
  } else if (minutes > 0) {
    return `${minutes}分${secs}秒`
  } else {
    return `${secs}秒`
  }
}

async function main() {
  const timestamp = new Date().toLocaleString('ja-JP')
  console.log(`\n[${timestamp}] バッチ生成進捗確認`)
  console.log('='.repeat(60))

  // APIから進捗を取得
  const templatesUrl = `${API_BASE_URL}/api/banner/test/templates`
  const apiData = await fetchJson(templatesUrl)

  if (!apiData) {
    console.log('⚠️  APIに接続できませんでした')
    return
  }

  const total = apiData.count || 0
  const generated = apiData.generatedCount || 0
  const remaining = total - generated
  const progressPercent = total > 0 ? ((generated / total) * 100).toFixed(1) : 0

  console.log(`📊 全体進捗:`)
  console.log(`   総数: ${total}件`)
  console.log(`   生成済み: ${generated}件`)
  console.log(`   残り: ${remaining}件`)
  console.log(`   進捗: ${progressPercent}%`)
  console.log('')

  // 進捗ファイルからバッチ情報を取得
  const progress = loadProgress()
  if (progress) {
    const completedBatches = progress.completedBatches || 0
    const lastFinishedAt = progress.lastFinishedAt
      ? new Date(progress.lastFinishedAt).toLocaleString('ja-JP')
      : '不明'
    const lastResult = progress.lastResult || {}

    console.log(`📦 バッチ進捗:`)
    console.log(`   完了バッチ数: ${completedBatches}`)
    console.log(`   最終完了時刻: ${lastFinishedAt}`)
    if (lastResult.generated !== undefined) {
      console.log(`   最終バッチ結果: 生成=${lastResult.generated}, スキップ=${lastResult.skipped}, エラー=${lastResult.errors}`)
    }
    console.log('')
  } else {
    console.log('📦 バッチ進捗: 進捗ファイルが見つかりません（初回実行の可能性）')
    console.log('')
  }

  // 推定残り時間を計算（1件あたり30秒）
  if (remaining > 0) {
    const estimatedSeconds = remaining * 30
    const estimatedTime = formatTime(estimatedSeconds)
    console.log(`⏱️  推定残り時間: ${estimatedTime}`)
    console.log(`   （1件あたり約30秒 × ${remaining}件）`)
    console.log('')
  } else {
    console.log('✅ すべてのテンプレートが生成済みです！')
    console.log('')
  }

  // バッチ処理プロセスの確認
  console.log('🔄 プロセス状態:')
  try {
    const { execSync } = await import('child_process')
    const psOutput = execSync('ps aux | grep "batch-bootstrap-50.mjs" | grep -v grep', { encoding: 'utf-8' })
    if (psOutput.trim()) {
      console.log('   ✓ バッチ処理が実行中です')
    } else {
      console.log('   ⚠️  バッチ処理プロセスが見つかりません')
    }
  } catch {
    console.log('   ⚠️  プロセス確認に失敗しました')
  }
  console.log('')
}

main().catch((e) => {
  console.error('エラー:', e.message)
  process.exit(1)
})
