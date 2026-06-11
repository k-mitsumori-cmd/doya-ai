// ============================================
// ドヤスライド スタイルプレビュー一括再生成
// ============================================
// 12スタイル × 3ページ = 36枚を生成して Supabase Storage の共有キャッシュ
// (style-previews/<現行版>) に upsert する。
// プロンプトや STYLE_PREVIEW_DIR の版を更新したあとに実行する。
//
// 実行: npx tsx scripts/regenerate-doyaslide-style-previews.ts
//   --only=corporate,pop  対象スタイルを絞る（省略で全スタイル）
//   --page=1              対象ページ番号を絞る（0=表紙,1=本文,2=まとめ。省略で全ページ）
//   --force               既存キャッシュがあっても焼き直す（既定: スキップ）
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local を読み込む（既存の環境変数は上書きしない）
for (const line of readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  // env 設定後に動的 import（モジュール読込時に env を参照するため）
  const { STYLE_PRESETS, getStylePreviewColor, STYLE_PREVIEW_SAMPLE_SLIDES } = await import(
    '../src/lib/doyaslide/constants'
  )
  const { buildImagePrompt } = await import('../src/lib/doyaslide/prompts')
  const { uploadStylePreview, stylePreviewExists } = await import('../src/lib/doyaslide/storage')
  const { generateImageWithFallback } = await import('../src/lib/image-generator')

  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null
  const pageArg = process.argv.find((a) => a.startsWith('--page='))
  const onlyPage = pageArg ? Number(pageArg.slice('--page='.length)) : null
  const force = process.argv.includes('--force')

  const styles = STYLE_PRESETS.filter((s) => !only || only.includes(s.value))
  const jobs: { style: string; page: number }[] = []
  for (const s of styles) {
    for (let page = 0; page < STYLE_PREVIEW_SAMPLE_SLIDES.length; page++) {
      if (onlyPage !== null && page !== onlyPage) continue
      jobs.push({ style: s.value, page })
    }
  }
  console.log(`対象: ${styles.length}スタイル × ${STYLE_PREVIEW_SAMPLE_SLIDES.length}ページ = ${jobs.length}枚`)

  let done = 0
  let failed = 0
  const CONCURRENCY = 4
  const queue = [...jobs]

  async function worker(id: number) {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      const label = `${job.style}-${job.page}`
      try {
        if (!force && (await stylePreviewExists(job.style, job.page))) {
          done++
          console.log(`[${done + failed}/${jobs.length}] skip(キャッシュ済): ${label}`)
          continue
        }
        const slide = STYLE_PREVIEW_SAMPLE_SLIDES[job.page]
        const prompt = buildImagePrompt({
          slide,
          themeColor: getStylePreviewColor(job.style),
          stylePreset: job.style,
          hasLogo: false,
          logoPosition: 'top-right',
          pageNumber: slide.index,
        })
        const started = Date.now()
        const img = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'high' })
        await uploadStylePreview(job.style, img.base64, job.page)
        done++
        console.log(
          `[${done + failed}/${jobs.length}] ok: ${label} (${img.model}${img.fallbackUsed ? '/fallback' : ''}, ${Math.round((Date.now() - started) / 1000)}s)`
        )
      } catch (e: any) {
        failed++
        console.error(`[${done + failed}/${jobs.length}] FAILED: ${label}: ${e?.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)))
  console.log(`完了: ${done}枚成功 / ${failed}枚失敗`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
