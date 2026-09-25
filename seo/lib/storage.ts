import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const SEO_BUCKET = process.env.SEO_STORAGE_BUCKET || 'seo-generated-images'
const DURABLE_PREFIX = 'supabase:'
let storageClient: SupabaseClient | null = null
let bucketReady = false

function isDurableStorage() {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || isServerlessReadonlyCwd())
}

function getStorageClient() {
  if (storageClient) return storageClient
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SEO durable storage is not configured')
  storageClient = createClient(url, key, { auth: { persistSession: false } })
  return storageClient
}

async function ensurePrivateBucket() {
  if (bucketReady) return
  const storage = getStorageClient().storage
  let { data, error } = await storage.getBucket(SEO_BUCKET)
  if (!data && (error?.status === 404 || error?.statusCode === '404')) {
    const created = await storage.createBucket(SEO_BUCKET, { public: false })
    if (created.error && !created.error.message?.includes('already exists')) throw new Error('SEO storage bucket unavailable')
    ;({ data, error } = await storage.getBucket(SEO_BUCKET))
  }
  if (error || !data || data.public) throw new Error('SEO private storage bucket unavailable')
  bucketReady = true
}

function durablePath(value: string) {
  const key = value.slice(DURABLE_PREFIX.length)
  if (!/^images\/[A-Za-z0-9._-]+\.png$/.test(key) || key.includes('..')) throw new Error('Invalid SEO storage path')
  return key
}

type SaveBase64Args = {
  base64: string
  filename: string
  subdir?: string
}

function isServerlessReadonlyCwd() {
  const cwd = process.cwd()
  // Vercel/AWS Lambda では /var/task が読み取り専用
  return cwd.startsWith('/var/task')
}

function getBaseDir() {
  const envDir =
    process.env.SEO_STORAGE_DIR ||
    process.env.NEXT_PUBLIC_SEO_STORAGE_DIR ||
    process.env.SEO_LOCAL_STORAGE_DIR ||
    ''
  if (envDir) return envDir

  // Vercel等: /tmp が書き込み可能
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || isServerlessReadonlyCwd()) {
    return '/tmp/seo'
  }

  // ローカル/VM: プロジェクト直下に保存
  return path.join(process.cwd(), 'seo')
}

let ensured = false
let ensuredBaseDir: string | null = null

export async function ensureSeoStorage() {
  if (isDurableStorage()) {
    await ensurePrivateBucket()
    return
  }
  if (ensured) return
  const base = getBaseDir()
  try {
    fs.mkdirSync(base, { recursive: true })
    ensured = true
    ensuredBaseDir = base
    return
  } catch (e: any) {
    // /var/task 等で失敗したら /tmp にフォールバック
    const fallback = '/tmp/seo'
    fs.mkdirSync(fallback, { recursive: true })
    ensured = true
    ensuredBaseDir = fallback
  }
}

function assertInside(base: string, candidate: string) {
  if (candidate !== base && !candidate.startsWith(base + path.sep)) throw new Error('Path is outside SEO storage')
}

function getAbsolutePath(relOrAbs: string) {
  const base = path.resolve(ensuredBaseDir || getBaseDir())
  const input = String(relOrAbs || '')
  if (!input || input.includes('\\') || input.includes('\0')) throw new Error('Invalid storage path')
  const target = path.resolve(base, input)
  assertInside(base, target)
  return target
}

function stripDataUrlPrefix(b64: string) {
  const s = String(b64 || '')
  const m = s.match(/^data:.*?;base64,(.+)$/)
  return m ? m[1] : s
}

export async function saveBase64ToFile({ base64, filename, subdir }: SaveBase64Args) {
  await ensureSeoStorage()
  const safeSubdir = (subdir || '').trim()
  const relDir = safeSubdir ? safeSubdir : ''
  if (safeSubdir.includes('\\') || safeSubdir.includes('\0')) throw new Error('Invalid storage directory')
  if (!filename || filename !== path.basename(filename) || /[\\/]/.test(filename) || filename === '.' || filename === '..') throw new Error('Invalid storage filename')
  const clean = stripDataUrlPrefix(base64)
  const buf = Buffer.from(clean, 'base64')
  const extension = path.extname(filename)
  const storedFilename = `${path.basename(filename, extension)}_${randomUUID()}${extension}`
  if (isDurableStorage()) {
    if (safeSubdir !== 'images' || extension.toLowerCase() !== '.png') throw new Error('Invalid SEO image destination')
    const key = durablePath(`${DURABLE_PREFIX}images/${storedFilename}`)
    // Persist intent before writing bytes. A crash after upload leaves a retryable record.
    const pendingKey = `seo-image-pending:v1:${randomUUID()}`
    await prisma.systemSetting.create({ data: { key: pendingKey, value: JSON.stringify({ path: `${DURABLE_PREFIX}${key}`, createdAt: new Date().toISOString() }) } })
    const { error } = await getStorageClient().storage.from(SEO_BUCKET).upload(key, buf, { contentType: 'image/png', upsert: false })
    if (error) throw new Error('SEO image upload failed')
    return { absolutePath: '', relativePath: `${DURABLE_PREFIX}${key}` }
  }
  const base = ensuredBaseDir || getBaseDir()
  const absDir = path.resolve(base, safeSubdir)
  const basePath = path.resolve(base)
  if (absDir !== basePath && !absDir.startsWith(basePath + path.sep)) throw new Error('Invalid storage directory')
  fs.mkdirSync(absDir, { recursive: true })
  assertInside(fs.realpathSync(base), fs.realpathSync(absDir))

  const absPath = path.join(absDir, storedFilename)
  fs.writeFileSync(absPath, buf, { flag: 'wx' })

  const relativePath = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), storedFilename) : storedFilename
  return { absolutePath: absPath, relativePath }
}

export async function readFileAsBuffer(relOrAbsPath: string) {
  if (relOrAbsPath.startsWith(DURABLE_PREFIX)) {
    await ensurePrivateBucket()
    const key = durablePath(relOrAbsPath)
    const { data, error } = await getStorageClient().storage.from(SEO_BUCKET).download(key)
    if (error || !data) {
      if (error?.statusCode === '404' || error?.message?.includes('not found')) throw Object.assign(new Error('SEO image missing'), { code: 'ENOENT' })
      throw new Error('SEO image download failed')
    }
    return Buffer.from(await data.arrayBuffer())
  }
  await ensureSeoStorage()
  const abs = getAbsolutePath(relOrAbsPath)
  const base = await fs.promises.realpath(ensuredBaseDir || getBaseDir())
  const target = await fs.promises.realpath(abs)
  assertInside(base, target)
  return fs.promises.readFile(target)
}

/** Only purge names created by the private SEO image writer. Legacy local paths are ignored. */
export async function removeSeoStoredImages(paths: string[]) {
  const keys = paths.filter(value => value.startsWith(DURABLE_PREFIX)).map(durablePath)
  if (!keys.length) return
  await ensurePrivateBucket()
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await getStorageClient().storage.from(SEO_BUCKET).remove(keys.slice(i, i + 100))
    if (error) throw new Error('SEO image removal failed')
  }
}
