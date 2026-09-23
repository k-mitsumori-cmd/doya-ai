import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const BUCKET = 'persona-private-images'
export const MAX_PERSONA_IMAGE_BYTES = 4 * 1024 * 1024
let client: SupabaseClient | undefined

function storage() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Persona image storage is not configured')
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      }) },
    })
  }
  return client.storage
}

/** Provisioned separately. Never downgrade privacy or fall back to public/local storage. */
export async function assertPersonaImageStorage() {
  const { data, error } = await storage().getBucket(BUCKET)
  if (error || !data || data.public !== false) throw new Error('Private persona image storage is unavailable')
}

function assertPath(path: string) {
  const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
  if (!new RegExp(`^${uuid}/${uuid}/${uuid}\\.png$`).test(path)) throw new Error('Invalid persona image path')
}

/** Decode a real raster image, discard metadata, and cap both decode work and response size. */
export async function normalizePersonaImage(base64: string, outputSize?: { width: number; height: number }): Promise<Buffer> {
  if (outputSize && (![outputSize.width, outputSize.height].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 2048))) throw new Error('Invalid persona output dimensions')
  if (!base64 || base64.length > 16 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Invalid persona image data')
  const raw = Buffer.from(base64, 'base64')
  const source = sharp(raw, { limitInputPixels: 16 * 1024 * 1024, animated: false })
  const metadata = await source.metadata()
  if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('Invalid persona image format')
  const oriented = source.rotate()
  const result = await (outputSize
    ? oriented.resize({ ...outputSize, fit: 'cover', position: 'centre' })
    : oriented.resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })).png().toBuffer()
  if (result.length > MAX_PERSONA_IMAGE_BYTES) throw new Error('Persona image exceeds storage limit')
  return result
}

export async function savePersonaImageFile(path: string, buffer: Buffer) {
  assertPath(path)
  if (!buffer.length || buffer.length > MAX_PERSONA_IMAGE_BYTES) throw new Error('Invalid persona image size')
  await assertPersonaImageStorage()
  const { error } = await storage().from(BUCKET).upload(path, buffer, { contentType: 'image/png', upsert: false })
  if (error) throw new Error('Persona image upload failed')
  return path
}

/** Call only after checking the job's owner and non-deleted project in the database. */
export async function readPersonaImageFile(path: string): Promise<Buffer> {
  assertPath(path)
  await assertPersonaImageStorage()
  const { data, error } = await storage().from(BUCKET).download(path)
  if (error || !data || !data.size || data.size > MAX_PERSONA_IMAGE_BYTES) throw new Error('Persona image download failed')
  return Buffer.from(await data.arrayBuffer())
}

/** Used for a known attempt whose upload succeeded but whose fenced settlement did not. */
export async function removePersonaImageFile(path: string) {
  assertPath(path)
  await assertPersonaImageStorage()
  const { error } = await storage().from(BUCKET).remove([path])
  if (error) throw new Error('Persona image cleanup failed')
}

/** Only for a deleted project whose workers have expired. One bounded batch per call.
 * Scan the namespace, not outputRef: timed-out uploads may never have reached the DB.
 * Re-list from the start after deletion so shifting offsets cannot skip objects.
 */
export async function purgeDeletedPersonaImageBatch(projectId: string): Promise<boolean> {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
  if (!uuid.test(projectId)) throw new Error('Invalid persona project path')
  await assertPersonaImageStorage()
  const bucket = storage().from(BUCKET)
  const folders = await bucket.list(projectId, { limit: 1, offset: 0, sortBy: { column: 'name', order: 'asc' } })
  if (folders.error || !folders.data) throw new Error('Persona image cleanup listing failed')
  if (!folders.data.length) return true
  const folder = folders.data[0]
  if (folder.id || !uuid.test(folder.name)) throw new Error('Unexpected persona image folder')
  const prefix = `${projectId}/${folder.name}`
  const files = await bucket.list(prefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })
  if (files.error || !files.data || !files.data.length) throw new Error('Persona image cleanup listing failed')
  const paths = files.data.map(file => {
    const path = `${prefix}/${file.name}`
    assertPath(path)
    if (!file.id) throw new Error('Unexpected persona image object')
    return path
  })
  const removed = await bucket.remove(paths)
  if (removed.error) throw new Error('Persona image cleanup failed')
  // Confirm an empty namespace on a later invocation before recording completion.
  return false
}
