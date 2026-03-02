import fs from 'node:fs'
import path from 'node:path'

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

function getAbsolutePath(relOrAbs: string) {
  const base = ensuredBaseDir || getBaseDir()
  const p = String(relOrAbs || '')
  if (!p) return path.join(base, 'images', 'missing')
  if (path.isAbsolute(p)) return p
  return path.join(base, p)
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
  const absDir = safeSubdir ? path.join(base, safeSubdir) : base
  fs.mkdirSync(absDir, { recursive: true })

  const clean = stripDataUrlPrefix(base64)
  const buf = Buffer.from(clean, 'base64')
  const absPath = path.join(absDir, filename)
  fs.writeFileSync(absPath, buf)

  const relativePath = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), filename) : filename
  return { absolutePath: absPath, relativePath }
}

export async function readFileAsBuffer(relOrAbsPath: string) {
  await ensureSeoStorage()
  const abs = getAbsolutePath(relOrAbsPath)
  return fs.promises.readFile(abs)
}

