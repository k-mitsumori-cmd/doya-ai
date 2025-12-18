import path from 'path'
import { promises as fs } from 'fs'

export function getSeoStorageDir(): string {
  return path.join(process.cwd(), 'seo', 'storage')
}

export function getSeoImagesDir(): string {
  return path.join(getSeoStorageDir(), 'images')
}

export async function ensureSeoStorage(): Promise<void> {
  await fs.mkdir(getSeoImagesDir(), { recursive: true })
}

export async function saveBase64ToFile(args: {
  base64: string
  filename: string
  subdir?: string
}): Promise<{ absolutePath: string; relativePath: string }> {
  const dir = args.subdir ? path.join(getSeoStorageDir(), args.subdir) : getSeoStorageDir()
  await fs.mkdir(dir, { recursive: true })
  const absolutePath = path.join(dir, args.filename)
  const buf = Buffer.from(args.base64, 'base64')
  await fs.writeFile(absolutePath, buf)
  const relativePath = path.relative(process.cwd(), absolutePath)
  return { absolutePath, relativePath }
}

export async function readFileAsBuffer(absoluteOrRelativePath: string): Promise<Buffer> {
  const p = path.isAbsolute(absoluteOrRelativePath)
    ? absoluteOrRelativePath
    : path.join(process.cwd(), absoluteOrRelativePath)
  return await fs.readFile(p)
}


