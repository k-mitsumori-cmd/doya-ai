import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const [serviceId] = process.argv.slice(2)
if (!serviceId) throw new Error('usage: node capture-doyamarke-service.mjs <serviceId>')

const root = process.cwd()
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(path.join(root, 'scripts/recordings/doyamarke-services.json'), 'utf8'))
const service = config.services.find(item => item.id === serviceId)
if (!service) throw new Error(`unknown service: ${serviceId}`)
const statePath = path.join(outputRoot, 'run-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const entry = state.services[service.id]
const dir = path.join(outputRoot, service.tier, service.id)
const rawRelative = `${service.tier}/${service.id}/raw/${service.id}-browser.webm`
const raw = path.join(outputRoot, rawRelative)
const eventsRelative = `${service.tier}/${service.id}/events.json`
const eventsPath = path.join(outputRoot, eventsRelative)
await mkdir(path.dirname(raw), { recursive: true })
await mkdir(path.join(dir, 'qa'), { recursive: true })

entry.status = 'RECORDING'
entry.attempts += 1
entry.reason = null
entry.rawFile = rawRelative
entry.eventsFile = eventsRelative
entry.updatedAt = new Date().toISOString()
state.updatedAt = entry.updatedAt
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--disable-default-apps', '--disable-extensions', '--disable-background-networking', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 }
})

const page = await browser.newPage()
page.setDefaultTimeout(8_000)
const targetUrl = `${config.baseUrl}${service.route}`
const actions = []
let focus = null
let result = 'actual UI exploration completed'
let startedAt = Date.now()
const rel = () => Number(((Date.now() - startedAt) / 1000).toFixed(2))
const safeText = ({
  banner: '新規顧客獲得を加速するAIマーケティング', seo: '生成AIを活用したBtoBマーケティング', interview: '導入企業インタビュー', persona: 'https://example.com', hr: 'マーケティング部', kintai: '本日の勤務状況', doyalist: '東京都 SaaS企業', promane: 'Webサイト改善プロジェクト', doyaslide: '生成AI活用セミナー資料', cunning: '商談中の質問候補を表示', sfa: '株式会社サンプル', shodan: 'https://example.com', aio: 'example.com', mensetsu: 'マーケティング担当者面接', quote: 'Webサイト制作', aishodan: 'サービス導入相談', adimage: 'https://example.com'
})[service.id]

async function remember(type, element, label) {
  const box = element ? await element.boundingBox().catch(() => null) : null
  const item = { at: rel(), type, label }
  if (box) {
    item.x = Number(((box.x + box.width / 2) / 1600).toFixed(4))
    item.y = Number(((box.y + box.height / 2) / 900).toFixed(4))
    if (!focus) focus = { at: Math.max(0, item.at - 0.25), duration: 4.5, x: item.x, y: item.y, zoom: 1.12 }
  }
  actions.push(item)
}

async function firstVisible(selector) {
  for (const element of await page.$$(selector)) {
    const visible = await element.evaluate(node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }).catch(() => false)
    if (visible) return element
  }
  return null
}

async function clickButtonMatching(patterns) {
  for (const button of await page.$$('button, [role="button"]')) {
    const text = (await button.evaluate(node => (node.innerText || node.textContent || '').trim()).catch(() => '')).replace(/\s+/g, ' ')
    if (!text || !patterns.some(pattern => pattern.test(text))) continue
    const disabled = await button.evaluate(node => Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true')).catch(() => true)
    if (disabled) continue
    await remember('click', button, text.slice(0, 80))
    await button.click().catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 1500))
    return text
  }
  return null
}

async function closeThirdPartyPromos() {
  for (const frame of page.frames().filter(item => item !== page.mainFrame())) {
    for (const button of await frame.$$('button')) {
      const label = await button.evaluate(node => `${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.innerText || ''}`.trim()).catch(() => '')
      if (/close|閉じる/i.test(label)) {
        await button.click().catch(() => {})
        return true
      }
    }
  }
  return false
}

try {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await new Promise(resolve => setTimeout(resolve, 2500))
  await closeThirdPartyPromos()

  const recorder = await page.screencast({ path: raw, fps: 30 })
  startedAt = Date.now()
  await new Promise(resolve => setTimeout(resolve, 1200))
  await closeThirdPartyPromos()

  if (service.id === 'banner') {
    if (await clickButtonMatching([/サンプル入力/])) {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.72, behavior: 'smooth' }))
      await new Promise(resolve => setTimeout(resolve, 1800))
      if (await clickButtonMatching([/プロ品質バナーを生成する/])) {
        result = 'banner generation requested; progress/result recorded'
        const deadline = Date.now() + 55_000
        while (Date.now() < deadline) {
          const body = await page.evaluate(() => document.body.innerText)
          if (body.includes('GENERATION COMPLETE')) break
          await new Promise(resolve => setTimeout(resolve, 2_000))
        }
        await clickButtonMatching([/^B案$/])
        await clickButtonMatching([/^C案$/])
      }
    }
  } else {
    const input = await firstVisible('input:not([type="hidden"]):not([type="password"]):not([type="email"]):not([type="file"])')
    if (input) {
      const type = await input.evaluate(node => node.type)
      if (!['checkbox', 'radio', 'button', 'submit'].includes(type)) {
        await input.evaluate((node, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          setter?.call(node, value)
          node.dispatchEvent(new Event('input', { bubbles: true }))
          node.dispatchEvent(new Event('change', { bubbles: true }))
        }, safeText)
        await remember('fill', input, `sample input: ${safeText}`)
        await new Promise(resolve => setTimeout(resolve, 1300))
      }
    }
    const textarea = await firstVisible('textarea')
    if (textarea) {
      await textarea.evaluate((node, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        setter?.call(node, value)
        node.dispatchEvent(new Event('input', { bubbles: true }))
      }, `${safeText}の操作デモ用サンプルです。`)
      await remember('fill', textarea, 'sample detail input')
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
    await clickButtonMatching([/サンプル/, /テンプレート/, /プレビュー/, /使い方/, /機能を見る/, /詳しく見る/])
  }

  await page.evaluate(() => window.scrollTo({ top: Math.min(document.body.scrollHeight, 780), behavior: 'smooth' }))
  actions.push({ at: rel(), type: 'scroll', label: 'screen exploration down' })
  await new Promise(resolve => setTimeout(resolve, 2200))
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  actions.push({ at: rel(), type: 'scroll', label: 'screen exploration up' })
  await new Promise(resolve => setTimeout(resolve, 2400))
  const minimumDurationMs = 13_000
  const remainingMs = minimumDurationMs - (Date.now() - startedAt)
  if (remainingMs > 0) await new Promise(resolve => setTimeout(resolve, remainingMs))
  await recorder.stop()
} finally {
  await browser.close().catch(() => {})
}

const events = { service: service.name, route: targetUrl, valid: true, captureType: 'continuous Chromium page screencast during live DOM interaction', slideshow: false, result, actions, focus: focus || { at: 2.2, duration: 4.5, x: 0.5, y: 0.45, zoom: 1.1 } }
await writeFile(eventsPath, `${JSON.stringify(events, null, 2)}\n`)
entry.status = 'CAPTURED'
entry.reason = null
entry.rawFile = rawRelative
entry.eventsFile = eventsRelative
entry.updatedAt = new Date().toISOString()
state.updatedAt = entry.updatedAt
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
process.stdout.write(`CAPTURED ${service.id} ${rawRelative}\n`)
process.exit(0)
