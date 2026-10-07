import { raceTimeout } from '@/lib/fetch-timeout'

type BucketMetadataClient = {
  getBucket(name: string): Promise<{ data: { public?: boolean } | null; error: unknown }>
  createBucket(name: string, options: { public: boolean; fileSizeLimit: number }): Promise<unknown>
}

/** Verify privacy on every operation; a previous private result must not survive a configuration change. */
export async function ensurePrivateImageBucket(storage: BucketMetadataClient, name: string, fileSizeLimit: number): Promise<void> {
  await raceTimeout('privateImageBucketMetadata', 15000, confirmPrivateImageBucket(storage, name, fileSizeLimit))
}

async function confirmPrivateImageBucket(storage: BucketMetadataClient, name: string, fileSizeLimit: number): Promise<void> {
  let result = await storage.getBucket(name)
  const error = result.error && typeof result.error === 'object' ? result.error as { status?: unknown; statusCode?: unknown } : null
  const missing = !result.data && (String(error?.status) === '404' || String(error?.statusCode) === '404')
  if (missing) {
    // Concurrent provisioning is safe only if the subsequent metadata read confirms a private bucket.
    await storage.createBucket(name, { public: false, fileSizeLimit })
    result = await storage.getBucket(name)
  }
  if (result.error || !result.data || result.data.public !== false) {
    throw new Error('非公開の画像保存先を確認できませんでした。')
  }
}
