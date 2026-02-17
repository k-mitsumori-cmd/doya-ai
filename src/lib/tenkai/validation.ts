// ============================================
// ドヤ展開AI — 出力バリデーション
// ============================================

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface PlatformConstraints {
  minChars?: number
  maxChars?: number
  titleMaxChars?: number
  headingMin?: number
  headingMax?: number
  tweetMaxChars?: number
  tweetMin?: number
  tweetMax?: number
  hashtagMin?: number
  hashtagMax?: number
  messageMin?: number
  messageMax?: number
  messageMinChars?: number
  messageMaxChars?: number
  subjectMinChars?: number
  subjectMaxChars?: number
  headlineMinChars?: number
  headlineMaxChars?: number
  leadMinChars?: number
  leadMaxChars?: number
}

const CONSTRAINTS: Record<string, PlatformConstraints> = {
  note: {
    minChars: 2000,
    maxChars: 5000,
    titleMaxChars: 40,
  },
  blog: {
    minChars: 3000,
    maxChars: 8000,
    headingMin: 4,
    headingMax: 8,
  },
  x: {
    tweetMaxChars: 280,
    tweetMin: 3,
    tweetMax: 10,
  },
  instagram: {
    minChars: 300,
    maxChars: 1000,
    hashtagMin: 20,
    hashtagMax: 30,
  },
  line: {
    messageMin: 1,
    messageMax: 3,
    messageMinChars: 100,
    messageMaxChars: 500,
  },
  facebook: {
    minChars: 500,
    maxChars: 1500,
  },
  linkedin: {
    minChars: 500,
    maxChars: 1300,
    hashtagMin: 3,
    hashtagMax: 5,
  },
  newsletter: {
    subjectMinChars: 30,
    subjectMaxChars: 40,
    minChars: 800,
    maxChars: 2000,
  },
  press_release: {
    headlineMinChars: 30,
    headlineMaxChars: 50,
    leadMinChars: 200,
    leadMaxChars: 300,
    minChars: 1000,
    maxChars: 2000,
  },
}

/**
 * プラットフォーム別の出力バリデーション
 */
export function validateOutput(
  platform: string,
  content: Record<string, unknown>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const c = CONSTRAINTS[platform]

  if (!c) {
    return { isValid: true, errors: [], warnings: [`未知のプラットフォーム: ${platform}`] }
  }

  if (!content || typeof content !== 'object') {
    return { isValid: false, errors: ['出力コンテンツが空またはJSON形式ではありません'], warnings: [] }
  }

  switch (platform) {
    case 'note':
      validateNote(content, c, errors, warnings)
      break
    case 'blog':
      validateBlog(content, c, errors, warnings)
      break
    case 'x':
      validateX(content, c, errors, warnings)
      break
    case 'instagram':
      validateInstagram(content, c, errors, warnings)
      break
    case 'line':
      validateLine(content, c, errors, warnings)
      break
    case 'facebook':
      validateFacebook(content, c, errors, warnings)
      break
    case 'linkedin':
      validateLinkedin(content, c, errors, warnings)
      break
    case 'newsletter':
      validateNewsletter(content, c, errors, warnings)
      break
    case 'press_release':
      validatePressRelease(content, c, errors, warnings)
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

function validateNote(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.title) errors.push('タイトルが未設定です')
  const title = String(content.title || '')
  if (content.title && title.length > c.titleMaxChars!) {
    warnings.push(`タイトルが${c.titleMaxChars}文字を超えています (${title.length}文字)`)
  }
  if (!content.body) errors.push('本文が未設定です')
  const bodyLen = String(content.body || '').length
  if (bodyLen < c.minChars!) warnings.push(`本文が短すぎます (${bodyLen}文字 / 推奨${c.minChars}文字以上)`)
  if (bodyLen > c.maxChars!) warnings.push(`本文が長すぎます (${bodyLen}文字 / 推奨${c.maxChars}文字以下)`)
}

function validateBlog(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  const seo = content.seo as Record<string, unknown> | undefined
  if (!seo?.title) errors.push('SEOタイトルが未設定です')
  if (!content.body_markdown && !content.body_html) errors.push('本文が未設定です')
  const bodyLen = String(content.body_markdown || content.body_html || '').length
  if (bodyLen < c.minChars!) warnings.push(`本文が短すぎます (${bodyLen}文字)`)
  if (bodyLen > c.maxChars!) warnings.push(`本文が長すぎます (${bodyLen}文字)`)
  const headings = String(content.body_markdown || '').match(/^##\s/gm)
  const headingCount = headings?.length || 0
  if (headingCount < c.headingMin!) warnings.push(`H2見出しが少なすぎます (${headingCount}個 / 推奨${c.headingMin}個以上)`)
  if (headingCount > c.headingMax!) warnings.push(`H2見出しが多すぎます (${headingCount}個 / 推奨${c.headingMax}個以下)`)
}

function validateX(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.tweets || !Array.isArray(content.tweets)) {
    errors.push('ツイート配列が未設定です')
    return
  }
  const tweets = content.tweets as Record<string, unknown>[]
  if (tweets.length < c.tweetMin!) warnings.push(`ツイート数が少なすぎます (${tweets.length}個)`)
  if (tweets.length > c.tweetMax!) warnings.push(`ツイート数が多すぎます (${tweets.length}個)`)
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i]
    const text = String(tweet.text || '')
    if (tweet.text && text.length > c.tweetMaxChars!) {
      errors.push(`ツイート${tweet.index ?? i + 1}が${c.tweetMaxChars}文字を超えています (${text.length}文字)`)
    }
  }
}

function validateInstagram(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.caption) errors.push('キャプションが未設定です')
  const captionLen = String(content.caption || '').length
  if (captionLen < c.minChars!) warnings.push(`キャプションが短すぎます (${captionLen}文字)`)
  if (captionLen > c.maxChars!) warnings.push(`キャプションが長すぎます (${captionLen}文字)`)
  const hashtags = Array.isArray(content.hashtags) ? content.hashtags : []
  const hashtagCount = hashtags.length
  if (hashtagCount < c.hashtagMin!) warnings.push(`ハッシュタグが少なすぎます (${hashtagCount}個)`)
  if (hashtagCount > c.hashtagMax!) warnings.push(`ハッシュタグが多すぎます (${hashtagCount}個)`)
}

function validateLine(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.messages || !Array.isArray(content.messages)) {
    errors.push('メッセージ配列が未設定です')
    return
  }
  const messages = content.messages as Record<string, unknown>[]
  if (messages.length < c.messageMin!) warnings.push(`メッセージ数が少なすぎます`)
  if (messages.length > c.messageMax!) warnings.push(`メッセージ数が多すぎます (${messages.length}個)`)
  for (let i = 0; i < messages.length; i++) {
    const msgLen = String(messages[i].text || '').length
    if (msgLen < c.messageMinChars!) warnings.push(`メッセージ${i + 1}が短すぎます (${msgLen}文字)`)
    if (msgLen > c.messageMaxChars!) warnings.push(`メッセージ${i + 1}が長すぎます (${msgLen}文字)`)
  }
}

function validateFacebook(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.post_text) errors.push('投稿文が未設定です')
  const textLen = String(content.post_text || '').length
  if (textLen < c.minChars!) warnings.push(`投稿文が短すぎます (${textLen}文字)`)
  if (textLen > c.maxChars!) warnings.push(`投稿文が長すぎます (${textLen}文字)`)
}

function validateLinkedin(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.post_text) errors.push('投稿文が未設定です')
  const textLen = String(content.post_text || '').length
  if (textLen < c.minChars!) warnings.push(`投稿文が短すぎます (${textLen}文字)`)
  if (textLen > c.maxChars!) warnings.push(`投稿文が長すぎます (${textLen}文字)`)
  const hashtags = Array.isArray(content.hashtags) ? content.hashtags : []
  const hashtagCount = hashtags.length
  if (hashtagCount < c.hashtagMin!) warnings.push(`ハッシュタグが少なすぎます (${hashtagCount}個)`)
  if (hashtagCount > c.hashtagMax!) warnings.push(`ハッシュタグが多すぎます (${hashtagCount}個)`)
}

function validateNewsletter(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.subject_line) errors.push('件名が未設定です')
  const subjectLen = String(content.subject_line || '').length
  if (subjectLen < c.subjectMinChars!) warnings.push(`件名が短すぎます (${subjectLen}文字)`)
  if (subjectLen > c.subjectMaxChars!) warnings.push(`件名が長すぎます (${subjectLen}文字)`)
  const bodyLen = String(content.body_text || content.body_html || '').length
  if (bodyLen < c.minChars!) warnings.push(`本文が短すぎます (${bodyLen}文字)`)
  if (bodyLen > c.maxChars!) warnings.push(`本文が長すぎます (${bodyLen}文字)`)
}

function validatePressRelease(
  content: Record<string, unknown>,
  c: PlatformConstraints,
  errors: string[],
  warnings: string[]
) {
  if (!content.headline) errors.push('見出しが未設定です')
  const headlineLen = String(content.headline || '').length
  if (headlineLen < c.headlineMinChars!) warnings.push(`見出しが短すぎます (${headlineLen}文字)`)
  if (headlineLen > c.headlineMaxChars!) warnings.push(`見出しが長すぎます (${headlineLen}文字)`)
  if (!content.lead_paragraph) errors.push('リード文が未設定です')
  const leadLen = String(content.lead_paragraph || '').length
  if (leadLen < c.leadMinChars!) warnings.push(`リード文が短すぎます (${leadLen}文字)`)
  if (leadLen > c.leadMaxChars!) warnings.push(`リード文が長すぎます (${leadLen}文字)`)
  const bodyLen = String(content.body || '').length
  if (bodyLen < c.minChars!) warnings.push(`本文が短すぎます (${bodyLen}文字)`)
  if (bodyLen > c.maxChars!) warnings.push(`本文が長すぎます (${bodyLen}文字)`)
}
