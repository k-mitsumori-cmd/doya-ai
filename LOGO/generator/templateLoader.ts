import fs from 'node:fs/promises'
import path from 'node:path'

export type TemplateId = 'japanese-modern' | 'japanese-minimal' | 'japanese-bold'

export async function loadMarkFromTemplate(templateId: TemplateId): Promise<string> {
  const fileMap: Record<TemplateId, string> = {
    'japanese-modern': 'japanese-modern.svg',
    'japanese-minimal': 'japanese-minimal.svg',
    'japanese-bold': 'japanese-bold.svg',
  }
  const file = fileMap[templateId]
  const tplPath = path.join(process.cwd(), 'LOGO', 'templates', file)
  const svg = await fs.readFile(tplPath, 'utf8')

  const m = svg.match(/<!--MARK_START-->([\s\S]*?)<!--MARK_END-->/)
  if (!m) {
    throw new Error(`Template ${templateId} is missing MARK block: ${tplPath}`)
  }
  return m[1].trim()
}








