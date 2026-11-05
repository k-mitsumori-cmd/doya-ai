'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { downscaleToDataUrl } from '@/lib/image-downscale'

export type BannerImageInputValue = {
  file: File | null
  preview: string | null
  pending: boolean
  error: string | null
}

type InputOwner = {
  key: string
  convert: (file: File, maxDimension: number) => Promise<string>
  errorMessage: (error: unknown) => string
  initialValue: BannerImageInputValue
  active: boolean
  job: object | null
  value: BannerImageInputValue
}

const emptyValue = (): BannerImageInputValue => ({ file: null, preview: null, pending: false, error: null })
const defaultReadError = () => '画像を読み込めませんでした。別の画像を選んでください。'

export type BannerImageInputOptions = {
  convert?: (file: File, maxDimension: number) => Promise<string>
  errorMessage?: (error: unknown) => string
}

/** Keep each file, preview and conversion result together within one account and input. */
export function useBannerImageInput(scope: string, maxDimension: number, options: BannerImageInputOptions = {}) {
  const key = JSON.stringify([scope, maxDimension])
  const convert = options.convert || downscaleToDataUrl
  const errorMessage = options.errorMessage || defaultReadError
  const owner = useMemo<InputOwner>(() => {
    const initialValue = emptyValue()
    return { key, convert, errorMessage, initialValue, active: false, job: null, value: initialValue }
  }, [key, convert, errorMessage])
  const committedOwner = useRef<InputOwner | null>(null)
  const [rendered, setRendered] = useState(() => ({ owner, value: owner.initialValue }))
  const current = () => committedOwner.current === owner && owner.active
  const publish = (value: BannerImageInputValue) => {
    owner.value = value
    setRendered({ owner, value })
  }

  useLayoutEffect(() => {
    committedOwner.current = owner
    owner.active = true
    // A previous setup may have been cleaned up by StrictMode while converting.
    if (owner.value.pending) {
      owner.value = emptyValue()
      setRendered({ owner, value: owner.value })
    }
    return () => {
      owner.active = false
      owner.job = null
      if (committedOwner.current === owner) committedOwner.current = null
    }
  }, [owner])

  const select = async (file: File) => {
    if (!current()) return
    const job = {}
    owner.job = job
    publish({ file, preview: null, pending: true, error: null })
    try {
      const convertInput = owner.convert
      const preview = await convertInput(file, maxDimension)
      if (!current() || owner.job !== job) return
      owner.job = null
      publish({ file, preview, pending: false, error: null })
    } catch (error) {
      if (!current() || owner.job !== job) return
      owner.job = null
      const formatError = owner.errorMessage
      publish({ file: null, preview: null, pending: false, error: formatError(error) || defaultReadError() })
    }
  }

  const clear = () => {
    if (!current()) return
    owner.job = null
    publish(emptyValue())
  }

  return {
    ...(rendered.owner === owner ? rendered.value : owner.initialValue),
    select,
    clear,
    // Read synchronously at submission and again after an awaited quota check.
    read: () => current() ? owner.value : null,
  }
}
