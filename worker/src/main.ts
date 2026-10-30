import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { claimJob, closePool } from './db.js'
import { runJob } from './runner.js'

// 起動の形:
//  - MEDIA_JOB_ID あり: そのジョブ1件を処理して終わる(Cloud Run Jobs の通常の起動)
//  - MEDIA_JOB_ID なし: 順番待ちを古い順に最大 MEDIA_DRAIN_MAX 件処理して終わる(手動・ローカル用)
// 終了コード: 0=処理した、またはやることが無かった。ジョブの失敗は DB の再試行で扱うので 0 で終わる。2=起動できなかった（設定の誤りなど）
async function main() {
  const workerId = `${process.env.CLOUD_RUN_EXECUTION || 'local'}-${randomUUID().slice(0, 8)}`
  const targetId = process.env.MEDIA_JOB_ID?.trim() || undefined
  const max = targetId ? 1 : config.drainMax()
  let handled = 0
  for (let i = 0; i < max; i++) {
    const job = await claimJob(workerId, targetId)
    if (!job) {
      console.log(targetId ? `ジョブ ${targetId} は実行できる状態ではありません（処理済み・待ち時間中・他が実行中）` : '順番待ちのジョブはありません')
      break
    }
    const { followUpIds } = await runJob(job, workerId)
    handled++
    // 続けて積まれたジョブ(音声ができたあとの文字起こしなど)は、この実行の中でそのまま処理する
    const queue = [...followUpIds]
    while (queue.length > 0) {
      const next = await claimJob(workerId, queue.shift())
      if (!next) continue
      queue.push(...(await runJob(next, workerId)).followUpIds)
      handled++
    }
  }
  console.log(`終了: ${handled}件を処理しました`)
}

main()
  .then(() => closePool().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('ワーカーを起動できませんでした:', e instanceof Error ? e.message : e)
    await closePool().catch(() => {})
    process.exit(2)
  })
