// ============================================
// ドヤインタビュー素材の中身の検査（ファイル先頭のバイト）
// ============================================
// なぜ必要か（2026-10-18 のシステム点検 SEC-069）:
//   以前は拡張子と、クライアントが申告した MIME タイプしか見ていなかった。
//   音声と偽って任意のファイルを置けるため、アップロードの確定時に先頭のバイトで形式を確かめる。
// ⚠️ 外部に依存しない純粋な関数にしておく（テストしやすくするため）。
import type { MaterialType } from './types'

/** 判定に読む先頭のバイト数 */
export const SIGNATURE_BYTES = 64

const ascii = (head: Uint8Array, offset: number, text: string) =>
  head.length >= offset + text.length && [...text].every((c, i) => head[offset + i] === c.charCodeAt(0))
const bytes = (head: Uint8Array, offset: number, values: number[]) =>
  head.length >= offset + values.length && values.every((v, i) => head[offset + i] === v)

/** 音声・動画のコンテナ（音声と動画で形式が重なるので、まとめて判定する） */
function isMedia(head: Uint8Array): boolean {
  return ascii(head, 0, 'ID3')                                  // mp3（ID3 タグ付き）
    || (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) // mp3 / aac のフレーム
    || (ascii(head, 0, 'RIFF') && (ascii(head, 8, 'WAVE') || ascii(head, 8, 'AVI '))) // wav / avi
    || ascii(head, 4, 'ftyp')                                   // mp4 / m4a / mov
    || ['moov', 'mdat', 'wide', 'free', 'skip'].some((box) => ascii(head, 4, box)) // 古い mov
    || bytes(head, 0, [0x1a, 0x45, 0xdf, 0xa3])                 // webm / mkv
    || ascii(head, 0, 'OggS')                                   // ogg
    || ascii(head, 0, 'fLaC')                                   // flac
}

function isPdf(head: Uint8Array): boolean {
  // 先頭に BOM や空白が入る PDF もあるので、最初の 16 バイトの中に %PDF- があればよい
  for (let i = 0; i <= 16; i++) if (ascii(head, i, '%PDF-')) return true
  return false
}

function isImage(head: Uint8Array): boolean {
  return bytes(head, 0, [0xff, 0xd8, 0xff])                     // jpeg
    || bytes(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // png
    || (ascii(head, 0, 'RIFF') && ascii(head, 8, 'WEBP'))       // webp
}

function isText(head: Uint8Array, mimeType: string | null | undefined): boolean {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return bytes(head, 0, [0x50, 0x4b, 0x03, 0x04])             // docx（zip）
  }
  // プレーンテキスト: NUL を含まないこと（バイナリを text と偽る置き方を防ぐ）
  return head.length > 0 && !head.includes(0)
}

/**
 * ファイル先頭のバイトが、素材の種類と合っているか。
 * 合わないとき（中身が別の形式、または空）は false。
 */
export function matchesInterviewFileSignature(type: MaterialType, mimeType: string | null | undefined, head: Uint8Array): boolean {
  switch (type) {
    case 'audio':
    case 'video':
      return isMedia(head)
    case 'pdf':
      return isPdf(head)
    case 'image':
      return isImage(head)
    case 'text':
      return isText(head, mimeType)
    case 'url':
      return true
    default:
      return false
  }
}
