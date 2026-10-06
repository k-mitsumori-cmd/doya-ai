type Entry<T> = { file: File; attempt: T }
type Bucket<T> = { entries: Entry<T>[]; tail: Promise<void> }
type Registry<T> = { files: WeakMap<File, T | Promise<T>>; buckets: Map<string, Bucket<T>> }
const registries = new WeakMap<object, unknown>()
const CHUNK_BYTES = 1024 * 1024

function assertActive(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Upload comparison cancelled')
}

// A File read cannot be cancelled, but abandoned reads cannot hold up a retry or
// retain listeners/timers. Each pending allocation is at most one small chunk.
async function readChunk(file: File, offset: number, signal: AbortSignal): Promise<Uint8Array> {
  assertActive(signal)
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: () => void = () => {}
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('Upload comparison cancelled'))
    signal.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => reject(new Error('Upload comparison timed out')), 35_000)
  })
  try {
    const bytes = await Promise.race([file.slice(offset, offset + CHUNK_BYTES).arrayBuffer(), stopped])
    assertActive(signal)
    return new Uint8Array(bytes)
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

async function equalContents(a: File, b: File, signal: AbortSignal) {
  for (let offset = 0; offset < a.size; offset += CHUNK_BYTES) {
    const batch = new AbortController()
    const abort = () => batch.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) batch.abort()
    try {
      const [left, right] = await Promise.all([readChunk(a, offset, batch.signal), readChunk(b, offset, batch.signal)])
      if (left.length !== right.length) return false
      for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false
    } finally {
      batch.abort()
      signal.removeEventListener('abort', abort)
    }
  }
  assertActive(signal)
  return true
}

/** Same File retries are synchronous; reselected metadata matches require byte equality. */
export function findInterviewUploadAttempt<T extends object>(
  file: File, attempts: Map<string, T>, create: () => T, signal: AbortSignal,
): T | Promise<T> {
  assertActive(signal)
  let registry = registries.get(attempts) as Registry<T> | undefined
  if (!registry) {
    registry = { files: new WeakMap(), buckets: new Map() }
    registries.set(attempts, registry)
  }
  const cached = registry.files.get(file)
  if (cached) return cached
  const metadata = JSON.stringify([file.name, file.size, file.type, file.lastModified])
  let bucket = registry.buckets.get(metadata)
  const add = (target: Bucket<T>) => {
    assertActive(signal)
    const attempt = create()
    attempts.set(JSON.stringify([metadata, target.entries.length]), attempt)
    target.entries.push({ file, attempt })
    return attempt
  }
  if (!bucket) {
    bucket = { entries: [], tail: Promise.resolve() }
    registry.buckets.set(metadata, bucket)
    const attempt = add(bucket)
    registry.files.set(file, attempt)
    return attempt
  }
  const currentRegistry = registry
  const currentBucket = bucket
  // Serialize comparisons in a metadata bucket so simultaneous reselections of
  // the same bytes cannot allocate two independent request keys.
  const pending = bucket.tail.then(async () => {
    assertActive(signal)
    for (const entry of currentBucket.entries) {
      if (await equalContents(file, entry.file, signal)) return entry.attempt
    }
    return add(currentBucket)
  })
  registry.files.set(file, pending)
  bucket.tail = pending.then(() => {}, () => {})
  void pending.then(attempt => currentRegistry.files.set(file, attempt), () => currentRegistry.files.delete(file))
  return pending
}
