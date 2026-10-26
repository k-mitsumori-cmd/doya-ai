// 「面の画像をまとめて作る」の進め方（画面の部品から切り出した、React を使わない処理。テストで確かめる）。
// 1面ずつ順に作り、面ごとに状態と理由を残す（2026-10-26 ユーザーの指摘「作っているのか分からない・画像が作られない」）。
// - 押したらすぐ、全部の面を「待ち」にし、1面目を「作成中」にする（画面は「作り始めました」と出す）
// - 1面が失敗しても、その面に理由を書いて次の面へ進む
// - 止めている（準備中）・上限・未ログインのときは、続けても同じ理由で作れないので、残りの面に理由を書いて止める

export type BatchFaceStatus = 'waiting' | 'working' | 'done' | 'failed' | 'skipped'

export interface BatchFace {
  id: string
  name: string
  status: BatchFaceStatus
  /** 失敗・作っていないときの理由（利用者に見せる日本語） */
  message?: string
}

export type BatchFailure = { tone: 'error' | 'forbidden' | 'disabled' | 'limit'; message: string }
export type BatchResult = { ok: true; images: string[] } | ({ ok: false } & BatchFailure)

export const SKIPPED_MESSAGE = '前の面と同じ理由で、作っていません。'
export const NO_IMAGE_MESSAGE = '画像が返ってきませんでした。内容を変えて、もう一度お試しください。'

export function batchSummary(faces: BatchFace[]) {
  const count = (s: BatchFaceStatus) => faces.filter((f) => f.status === s).length
  const done = count('done')
  const failed = count('failed') + count('skipped')
  const working = count('working')
  const waiting = count('waiting')
  return { total: faces.length, done, failed, finished: done + failed, running: working + waiting > 0 && working > 0 }
}

/** 返ってきた結果を、面の失敗の理由にする（画像が無い成功も失敗として扱う） */
export function failureForFace(r: BatchResult): BatchFailure | null {
  if (r.ok) return r.images[0] ? null : { tone: 'error', message: NO_IMAGE_MESSAGE }
  return { tone: r.tone, message: r.message }
}

/**
 * 面を1つずつ作る。状態が変わるたびに onUpdate に面の一覧の写しを渡す。
 * 戻り値は、止まった理由（最後まで進んだときは undefined）。
 */
export async function runPanelBatch<P extends { id: string; name: string }>(
  targets: P[],
  request: (p: P) => Promise<BatchResult>,
  handlers: { onUpdate: (faces: BatchFace[]) => void; onImage: (p: P, image: string) => void },
): Promise<BatchFailure | undefined> {
  const list: BatchFace[] = targets.map((p) => ({ id: p.id, name: p.name, status: 'waiting' }))
  const put = (i: number, f: Partial<BatchFace>) => {
    list[i] = { ...list[i], ...f }
    handlers.onUpdate([...list])
  }
  for (const [i, p] of targets.entries()) {
    put(i, { status: 'working' })
    let r: BatchResult
    try {
      r = await request(p)
    } catch {
      r = { ok: false, tone: 'error', message: '通信できませんでした。接続を確かめて、もう一度お試しください。' }
    }
    const failure = failureForFace(r)
    if (!failure && r.ok) {
      handlers.onImage(p, r.images[0])
      put(i, { status: 'done', message: undefined })
      continue
    }
    put(i, { status: 'failed', message: failure!.message })
    if (failure!.tone !== 'error') {
      for (let k = i + 1; k < list.length; k++) list[k] = { ...list[k], status: 'skipped', message: SKIPPED_MESSAGE }
      handlers.onUpdate([...list])
      return failure!
    }
  }
  return undefined
}
