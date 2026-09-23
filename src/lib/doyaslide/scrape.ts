// ============================================
// ドヤスライド URL内容の取得（参考情報スクレイピング）
// ============================================
import * as cheerio from 'cheerio'
import { safeFetchResource } from '@/lib/net/safe-fetch'

export interface ScrapedPage {
  url: string
  title: string
  description: string
  text: string // 本文抽出（最大12000字）
}

/** URLのHTMLを取得し、タイトル・説明・本文テキストを抽出（SSRF対策つき） */
export async function scrapeUrlText(raw: string): Promise<ScrapedPage> {
  const resource = await safeFetchResource(raw, { timeoutMs: 15000, maxRedirects: 5, accept: 'text/html,application/xhtml+xml,text/plain' })
  if (!resource) throw new Error('URLを安全に取得できませんでした')
  if (!resource.contentType.includes('html') && !resource.contentType.includes('text')) throw new Error('HTMLページではありません')
  const html = resource.body.toString('utf8')
  const finalUrl = resource.url

  const $ = cheerio.load(html)
  const title = $('title').first().text().trim()
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    ''
  $('script, style, svg, noscript, iframe, link, nav, footer, header').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000)

  return { url: finalUrl, title, description, text }
}
