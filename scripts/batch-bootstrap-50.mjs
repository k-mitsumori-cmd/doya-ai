#!/usr/bin/env node

/**
 * ローカル環境: テンプレートを50件ずつバッチ生成するスクリプト
 *
 * 前提:
 * - `npm run dev` でローカルサーバーが起動している
 * - `.env.local` に DATABASE_URL / GOOGLE_GENAI_API_KEY が設定済み
 *
 * 実行:
 *   cd doya-ai
 *   node scripts/batch-bootstrap-50.mjs
 *
 * 挙動:
 * - `/api/banner/test/templates` からテンプレ一覧を取得
 * - `imageUrl` が空のものを優先して、50件ずつ `/api/banner/test/templates/bootstrap` に投げる
 * - 進捗を `scripts/.bootstrap-progress.json` に保存し、次回は続きから再開
 */

import fs from 'fs'
import path from 'path'

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const BATCH_SIZE = 50
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', '.bootstrap-progress.json')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // JSONでない場合でもログ用に返す
    return { raw: text }
  }
}

async function main() {
  console.log('=== バナー テンプレート一括生成（50件バッチ） ===')
  console.log(`API: ${API_BASE_URL}`)
  console.log(`BATCH_SIZE: ${BATCH_SIZE}`)
  console.log(`PROGRESS: ${PROGRESS_PATH}`)
  console.log('')

  const templatesUrl = `${API_BASE_URL}/api/banner/test/templates`
  const bootstrapUrl = `${API_BASE_URL}/api/banner/test/templates/bootstrap`

  const progress = loadProgress()
  if (progress?.completedBatches) {
    console.log(`[Resume] 既存の進捗を検出: 完了バッチ数=${progress.completedBatches}`)
  }

  const templatesPayload = await fetchJson(templatesUrl)
  const templates = templatesPayload?.templates || []
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error(`テンプレート一覧が取得できませんでした: ${templatesUrl}`)
  }

  // 未生成優先（imageUrlが空）→ それ以外
  const missing = templates.filter((t) => !t.imageUrl).map((t) => t.id)
  const existing = templates.filter((t) => !!t.imageUrl).map((t) => t.id)
  const orderedIds = [...missing, ...existing]

  // 既に完了したバッチ分をスキップ（再開用）
  const completedBatches = progress?.completedBatches || 0
  const startIndex = completedBatches * BATCH_SIZE

  const total = orderedIds.length
  const remaining = Math.max(0, total - startIndex)
  console.log(`テンプレ総数: ${total}`)
  console.log(`未生成: ${missing.length} / 生成済み: ${existing.length}`)
  console.log(`今回開始位置: ${startIndex}（残り ${remaining}）`)
  console.log('')

  let batchIndex = completedBatches

  for (let i = startIndex; i < total; i += BATCH_SIZE) {
    const batchIds = orderedIds.slice(i, i + BATCH_SIZE)
    if (batchIds.length === 0) break

    const batchNo = batchIndex + 1
    console.log(`\n[Batch ${batchNo}] ${batchIds.length}件 生成開始...`)
    console.log(`IDs: ${batchIds[0]} ... ${batchIds[batchIds.length - 1]}`)
    console.log('想定所要: 約25分（1件30秒 × 50件）')

    const result = await fetchJson(bootstrapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generateAll: false,
        templateIds: batchIds,
        skipExisting: true,
        setFirstAsFeatured: batchIndex === 0,
      }),
    })

    const generated = result?.generated ?? null
    const skipped = result?.skipped ?? null
    const errors = result?.errors ?? null
    console.log(`[Batch ${batchNo}] 完了: generated=${generated}, skipped=${skipped}, errors=${errors}`)

    // 進捗保存（バッチ単位）
    batchIndex += 1
    saveProgress({
      completedBatches: batchIndex,
      lastFinishedAt: new Date().toISOString(),
      lastResult: { generated, skipped, errors },
    })

    // 次のバッチ前に少し待機（サーバー安定化）
    if (i + BATCH_SIZE < total) {
      console.log('[Batch] 次のバッチまで 5秒待機...')
      await sleep(5000)
    }
  }

  console.log('\n=== すべてのバッチが完了しました ===')
  console.log(`進捗ファイル: ${PROGRESS_PATH}`)
  console.log('※ `scripts/.bootstrap-progress.json` を削除すると最初から再実行します。')
}

main().catch((e) => {
  console.error('\n✗ 失敗しました:', e?.message || e)
  process.exit(1)
})

