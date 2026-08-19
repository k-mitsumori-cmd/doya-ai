import sharp from 'sharp'
import path from 'node:path'

const games = '/Users/mitsumori_katsuki/Code/games'
const output = path.join(games, 'doyagame-portal-live/img')

await sharp(path.join(games, 'noroi-nikki/.vercel/output/static/noroi/campaign_start.png'))
  .resize(1536, 1024, { fit: 'cover' }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(output, 'noroi-nikki-art.jpg'))

const yurusenRoot = path.join(games, 'yurusenai-list/apps/web/public')
const yurusenCharacters = await Promise.all([
  ['mouja/oogoe_denwa.png', 180, 410, 470],
  ['mouja/mount_mouja.png', 575, 300, 590],
  ['mouja/doya_jiman.png', 1030, 420, 460],
].map(async ([file, left, top, width]) => ({
  input: await sharp(path.join(yurusenRoot, String(file))).resize(Number(width), Number(width), { fit: 'contain' }).png().toBuffer(),
  left: Number(left), top: Number(top),
})))
await sharp(path.join(yurusenRoot, 'lp/hero_bg.png')).resize(1536, 1024, { fit: 'cover' })
  .composite(yurusenCharacters).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(output, 'yurusen-art.jpg'))

const hitorijime = path.join(games, 'hitorijime/HITORIJIME-BRAND-ASSETS-20260810/03-character-app-icons/production/app-icon-character-duo-1024.png')
await sharp(hitorijime).extract({ left: 0, top: 0, width: 1024, height: 870 })
  .resize(1536, 1024, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(output, 'hitorijime-art.jpg'))

process.stdout.write('game cards: 3\n')
