// ============================================
// ドヤスライドの画像 URL の読み替え（保存した URL → 表示に使う URL）
// ============================================
// なぜ必要か（2026-10-18 のシステム点検 SEC-062）:
//   スライド画像・ロゴは公開バケットに置かれ、公開 URL を知る人は誰でも見られた。
//   バケットを非公開にしても表示が壊れないよう、画面は <img> に渡す直前に
//   自社の配信 URL（/api/doyaslide/files/<パス>。ログインと所有者を確かめてから返す）へ読み替える。
// ⚠️ DB と API の応答は、従来どおり Supabase の公開 URL の形のまま。既存データの移し替えは要らない。
//    画面は操作の結果と再読み込みの結果を URL の文字列で突き合わせているので、データ側は変えない。
// ⚠️ このファイルはブラウザーでも使う。サーバー専用のモジュールを import しない。

export const DOYASLIDE_BUCKET = 'doyaslide'
const PUBLIC_MARK = `/storage/v1/object/public/${DOYASLIDE_BUCKET}/`
export const DOYASLIDE_FILES_ROUTE = '/api/doyaslide/files/'
const SEGMENT_RE = /^[A-Za-z0-9._-]{1,200}$/
const STYLE_PREVIEW_PREFIX = 'style-previews/'

function supabaseHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
  } catch {
    return ''
  }
}

/** バケット内のパスとして安全か（.. や空の区切り、許可外の文字を拒否） */
export function isValidDoyaslidePath(path: string): boolean {
  if (!path || path.length > 1024) return false
  return path.split('/').every((s) => SEGMENT_RE.test(s) && s !== '.' && s !== '..')
}

/** 保存した公開 URL から、バケット内のパスを取り出す。ドヤスライドのバケットでなければ null。 */
export function doyaslidePathFromUrl(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = supabaseHost()
  if (!host || u.host !== host || !u.pathname.startsWith(PUBLIC_MARK)) return null
  let path: string
  try {
    path = u.pathname.slice(PUBLIC_MARK.length).split('/').map(decodeURIComponent).join('/')
  } catch {
    return null
  }
  return isValidDoyaslidePath(path) ? path : null
}

/** 配信 URL のパス部分から、バケット内のパスを取り出す（配信 API が使う） */
export function doyaslidePathFromSegments(segments: string[]): string | null {
  const path = segments.join('/')
  return isValidDoyaslidePath(path) ? path : null
}

/**
 * <img src> に渡す URL。ドヤスライドのバケットの画像なら配信 URL（同じパスなら毎回同じ文字列）に、
 * それ以外（data: URL や外部の画像）はそのまま返す。
 */
export function doyaslideImageSrc(url: string | null | undefined): string {
  if (!url) return ''
  const path = doyaslidePathFromUrl(url)
  return path ? `${DOYASLIDE_FILES_ROUTE}${path.split('/').map(encodeURIComponent).join('/')}` : url
}

/**
 * ログイン中のユーザーがそのパスを見てよいか。
 * 利用者のファイルは「<userId>/...」の形で保存しているので、先頭が自分の ID のものだけを許す。
 * スタイル見本（style-previews/）は全員共通の見本なので、誰でも見てよい。
 */
export function canReadDoyaslidePath(path: string, userId: string | null): boolean {
  if (!isValidDoyaslidePath(path)) return false
  if (path.startsWith(STYLE_PREVIEW_PREFIX)) return true
  return !!userId && path.split('/')[0] === userId
}
