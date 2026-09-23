import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

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
  const base = ensuredBaseDir || getBaseDir()
  const safeSubdir = (subdir || '').trim()
  const relDir = safeSubdir ? safeSubdir : ''
  if (safeSubdir.includes('\\') || safeSubdir.includes('\0')) throw new Error('Invalid storage directory')
  if (!filename || filename !== path.basename(filename) || /[\\/]/.test(filename) || filename === '.' || filename === '..') throw new Error('Invalid storage filename')
  const absDir = path.resolve(base, safeSubdir)
  const basePath = path.resolve(base)
  if (absDir !== basePath && !absDir.startsWith(basePath + path.sep)) throw new Error('Invalid storage directory')
  fs.mkdirSync(absDir, { recursive: true })
  assertInside(fs.realpathSync(base), fs.realpathSync(absDir))

  const clean = stripDataUrlPrefix(base64)
  const buf = Buffer.from(clean, 'base64')
  const extension = path.extname(filename)
  const storedFilename = `${path.basename(filename, extension)}_${randomUUID()}${extension}`
  const absPath = path.join(absDir, storedFilename)
  fs.writeFileSync(absPath, buf, { flag: 'wx' })

  const relativePath = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), storedFilename) : storedFilename
  return { absolutePath: absPath, relativePath }
}

export async function readFileAsBuffer(relOrAbsPath: string) {
  await ensureSeoStorage()
  const abs = getAbsolutePath(relOrAbsPath)
  const base = await fs.promises.realpath(ensuredBaseDir || getBaseDir())
  const target = await fs.promises.realpath(abs)
  assertInside(base, target)
  return fs.promises.readFile(target)
}

