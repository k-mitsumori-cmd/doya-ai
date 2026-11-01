import { createHash } from 'node:crypto'
/** Opaque identity is stable across signed URL renewal; never exposes private storage paths. */
export function slideImageKey(path: string | null | undefined): string | null {
  return typeof path === 'string' && path.length > 0 && path.length <= 8192
    ? createHash('sha256').update(path).digest('hex') : null
}
