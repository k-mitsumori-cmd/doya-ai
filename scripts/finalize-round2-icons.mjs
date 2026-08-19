import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const ids = ['banner','seo','interview','persona','hr','kintai','doyalist','doyaslide','cunning','promane','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
for (const id of ids) {
  const source = path.join(ROOT, 'public', id, 'icon.png')
  const targetDir = path.join(ROOT, 'src/app', id)
  const data = await fs.readFile(source)
  const meta = await sharp(data).metadata()
  if (meta.width !== 512 || meta.height !== 512 || meta.hasAlpha !== true || data.length > 80 * 1024) {
    throw new Error(`${id}: invalid icon ${meta.width}x${meta.height} alpha=${meta.hasAlpha} bytes=${data.length}`)
  }
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(path.join(targetDir, 'icon.png'), data)
  process.stdout.write(`${id}: favicon copied (${data.length} bytes)\n`)
}
