'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

const RETRY_LIMIT = 10
const RETRY_DELAY_MS = 1200
type Flags = Record<string, boolean>
type Values = {
  imgLoaded: Flags
  imgGenerating: Flags
  imgFailed: Flags
  imgRetry: Record<string, number>
  versions: Record<string, number>
}
const empty = (): Values => ({ imgLoaded: {}, imgGenerating: {}, imgFailed: {}, imgRetry: {}, versions: {} })

function createReadOwner(scopeId: string) {
  let values = empty()
  let active = true
  let busy = false
  let listener: (() => void) | undefined
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const current = () => active
  const publish = () => { if (current()) listener?.() }
  const cancel = (id: string) => {
    const timer = timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(id)
  }
  const reset = (id: string) => {
    cancel(id)
    values = {
      imgLoaded: { ...values.imgLoaded, [id]: false },
      imgGenerating: { ...values.imgGenerating, [id]: true },
      imgFailed: { ...values.imgFailed, [id]: false },
      imgRetry: { ...values.imgRetry, [id]: 0 },
      versions: { ...values.versions, [id]: (values.versions[id] || 0) + 1 },
    }
  }
  const src = (id: string) => `/api/seo/images/${encodeURIComponent(id)}?v=${values.imgRetry[id] || 0}&read=${encodeURIComponent(`${scopeId}:${values.versions[id] || 0}`)}`
  const accepts = (id: string, image: HTMLImageElement) => {
    if (!current() || image.getAttribute('src') !== src(id)) return false
    return !image.currentSrc || image.currentSrc === new URL(src(id), image.baseURI).href
  }
  const fail = (id: string) => {
    if (!current()) return
    const exhausted = !busy && (values.imgRetry[id] || 0) >= RETRY_LIMIT
    values = { ...values,
      imgLoaded: { ...values.imgLoaded, [id]: false },
      imgGenerating: { ...values.imgGenerating, [id]: !exhausted },
      imgFailed: { ...values.imgFailed, [id]: exhausted },
    }
    if (!busy && !exhausted && !timers.has(id)) {
      const timer = setTimeout(() => {
        if (timers.get(id) !== timer) return
        timers.delete(id)
        if (!current() || busy || values.imgLoaded[id]) return
        values = { ...values, imgRetry: { ...values.imgRetry, [id]: Math.min(RETRY_LIMIT, (values.imgRetry[id] || 0) + 1) } }
        publish()
      }, RETRY_DELAY_MS)
      timers.set(id, timer)
    }
    if (exhausted) cancel(id)
    publish()
  }
  const setImgGenerating: Dispatch<SetStateAction<Flags>> = (update) => {
    if (!current()) return
    const next = typeof update === 'function' ? update(values.imgGenerating) : update
    for (const id of Object.keys(next)) if (next[id] && !values.imgGenerating[id]) reset(id)
    values = { ...values, imgGenerating: next }
    publish()
  }
  const setImgLoaded: Dispatch<SetStateAction<Flags>> = (update) => {
    if (!current()) return
    values = { ...values, imgLoaded: typeof update === 'function' ? update(values.imgLoaded) : update }
    publish()
  }
  return {
    scopeId,
    snapshot: () => values,
    src,
    setImgGenerating,
    setImgLoaded,
    onLoad(id: string, image: HTMLImageElement) {
      if (!accepts(id, image)) return
      if (!image.naturalWidth || !image.naturalHeight) { fail(id); return }
      cancel(id)
      values = { ...values,
        imgLoaded: { ...values.imgLoaded, [id]: true },
        imgGenerating: { ...values.imgGenerating, [id]: false },
        imgFailed: { ...values.imgFailed, [id]: false },
      }
      publish()
    },
    onError(id: string, image: HTMLImageElement) { if (accepts(id, image)) fail(id) },
    retry(id: string) {
      if (!current() || busy) return
      reset(id)
      publish()
    },
    syncBusy(nextBusy: boolean) {
      if (!current()) return
      const wasBusy = busy
      busy = nextBusy
      if (busy) for (const id of timers.keys()) cancel(id)
      if (wasBusy && !busy) {
        for (const id of Object.keys(values.imgGenerating)) reset(id)
        publish()
      }
    },
    subscribe(next: () => void) {
      active = true
      listener = next
      publish()
      return () => {
        active = false
        listener = undefined
        for (const id of timers.keys()) cancel(id)
      }
    },
  }
}

/** 画像のGET読込だけを管理する。再読込で生成APIや利用枠の処理は呼ばない。 */
export function useSeoImageRead(scopeId: string, mediaBusy: boolean) {
  const owner = useMemo(() => createReadOwner(scopeId), [scopeId])
  const [snapshot, setSnapshot] = useState<{ owner: typeof owner; values: Values } | null>(null)
  useEffect(() => owner.subscribe(() => setSnapshot({ owner, values: owner.snapshot() })), [owner])
  useEffect(() => { owner.syncBusy(mediaBusy) }, [owner, mediaBusy])
  const values = snapshot?.owner === owner ? snapshot.values : owner.snapshot()
  return { ...values, src: owner.src, onLoad: owner.onLoad, onError: owner.onError, retry: owner.retry, setImgGenerating: owner.setImgGenerating, setImgLoaded: owner.setImgLoaded }
}

export type SeoImageRead = ReturnType<typeof useSeoImageRead>
