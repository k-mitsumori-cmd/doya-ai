import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'
import { claimJob, insertFollowUp, markFailed, markSucceeded, touch, type JobRow } from './db.js'
import { handlers } from './handlers/index.js'
import { PermanentError, signedInputUrl, uploadFile } from './storage.js'

/** 1件のジョブを最後まで処理する。ロックを失ったら（他のワーカーに取られたら）途中で止める */
export async function runJob(job: JobRow, workerId: string): Promise<{ outcome: 'succeeded' | 'requeued' | 'failed' | 'lost'; followUpIds: string[] }> {
  const log = (m: string) => console.log(`[${job.id}] ${m}`)
  const handler = handlers[job.kind]
  const workDir = await mkdtemp(join(config.tmpDir(), 'mediajob-'))
  let lost = false
  let lastPct = -1
  let lastSent = 0
  const send = (pct: number, stage: string) => {
    const now = Date.now()
    if (pct === lastPct || now - lastSent < 2000) return
    lastPct = pct
    lastSent = now
    touch(job.id, workerId, { progress: pct, stage }).then((ok) => {
      if (!ok) lost = true
    })
  }
  const hb = setInterval(() => {
    touch(job.id, workerId).then((ok) => {
      if (!ok) lost = true
    }).catch(() => {})
  }, config.heartbeatMs())

  try {
    if (!handler) throw new PermanentError(`未対応の種類です: ${job.kind}`)
    log(`開始 ${job.kind} (${job.attempts}/${job.maxAttempts}回目)`)
    const inputUrl = await signedInputUrl(job.inputBucket, job.inputPath, job.userId)
    // 進み具合は 3%〜90% を処理に、90%〜99% を保存に割り当てる
    const out = await handler({
      job,
      inputUrl,
      workDir,
      progress: (ratio, stage) => send(3 + Math.round(Math.min(1, Math.max(0, ratio)) * 87), stage),
    })
    if (lost) throw new Error('ロックを失ったため中止します')
    await touch(job.id, workerId, { progress: 90, stage: '結果を保存中' })
    const saved = []
    for (const [i, f] of out.outputs.entries()) {
      const path = `${job.userId}/${job.id}/${f.name}`
      const size = await uploadFile(config.outputBucket(), path, f.localPath, f.contentType)
      saved.push({ name: f.name, bucket: config.outputBucket(), path, contentType: f.contentType, size })
      await touch(job.id, workerId, { progress: 90 + Math.round(((i + 1) / out.outputs.length) * 9) })
    }
    const ok = await markSucceeded(job.id, workerId, saved, out.result)
    log(ok ? '完了' : 'ロックを失っていたため結果は反映しません')
    const followUpIds: string[] = []
    if (ok) {
      for (const f of out.followUps ?? []) {
        const id = await insertFollowUp(job, f)
        if (id) followUpIds.push(id)
      }
    }
    return { outcome: ok ? 'succeeded' : 'lost', followUpIds }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const permanent = e instanceof PermanentError
    const r = await markFailed(job, workerId, message, permanent)
    log(`失敗(${r}): ${message.slice(0, 300)}`)
    return { outcome: r, followUpIds: [] }
  } finally {
    clearInterval(hb)
    await rm(workDir, { recursive: true, force: true })
  }
}

export { claimJob }
