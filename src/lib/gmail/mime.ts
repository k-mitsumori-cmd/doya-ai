// RFC 2822 / MIME メッセージの組み立て。日本語は RFC 2047（件名）と base64（本文）で符号化する。

export interface MimeInput {
  from: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

const CRLF = '\r\n'

function encodeHeaderWord(value: string): string {
  // ASCII のみならそのまま。それ以外は UTF-8 の B エンコード（1語 75 文字以内に分割）
  if (/^[\x20-\x7e]*$/.test(value)) return value
  const chars = Array.from(value)
  const words: string[] = []
  let cur = ''
  for (const ch of chars) {
    if (Buffer.byteLength(cur + ch, 'utf8') > 36) {
      words.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) words.push(cur)
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join(`${CRLF} `)
}

function chunkBase64(buf: Buffer): string {
  return (buf.toString('base64').match(/.{1,76}/g) || []).join(CRLF)
}

// ヘッダ注入（改行）を防ぐ
export function assertSingleLine(value: string, label: string): void {
  if (/[\r\n]/.test(value)) throw new Error(`${label}に改行は使えません`)
}

export function buildMime(input: MimeInput): string {
  assertSingleLine(input.from, '送信元')
  assertSingleLine(input.to, '宛先')
  assertSingleLine(input.subject, '件名')
  if (input.replyTo) assertSingleLine(input.replyTo, '返信先')

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    ...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
    `Subject: ${encodeHeaderWord(input.subject)}`,
    'MIME-Version: 1.0',
  ]
  const textPart = (type: string, body: string) =>
    [`Content-Type: ${type}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '', chunkBase64(Buffer.from(body, 'utf8'))].join(CRLF)

  if (!input.html) {
    return [...headers, textPart('text/plain', input.text)].join(CRLF)
  }
  const boundary = `doya_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    textPart('text/plain', input.text),
    `--${boundary}`,
    textPart('text/html', input.html),
    `--${boundary}--`,
    '',
  ].join(CRLF)
}

export function toBase64Url(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
