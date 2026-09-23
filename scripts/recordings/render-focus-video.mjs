import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const [serviceId] = process.argv.slice(2)
if (!serviceId) throw new Error('usage: node render-focus-video.mjs <serviceId>')
const root = process.cwd()
const outputRoot = path.join(root, 'reference/generated-assets/2026-09-01-doyamarke-real-usage-focus-recordings')
const config = JSON.parse(await readFile(path.join(root, 'scripts/recordings/doyamarke-services.json'), 'utf8'))
const service = config.services.find(item => item.id === serviceId)
if (!service) throw new Error(`unknown service: ${serviceId}`)
const dir = path.join(outputRoot, service.tier, service.id)
const statePath = path.join(outputRoot, 'run-state.json')
const state = JSON.parse(await readFile(statePath, 'utf8'))
const stateEntry = state.services[serviceId]
const raw = stateEntry?.rawFile ? path.join(outputRoot, stateEntry.rawFile) : path.join(dir, 'raw', `${service.id}-display.mov`)
const eventsPath = path.join(dir, 'events.json')
const final = path.join(dir, `${service.id}-actual-operation-focus-16x9.mp4`)
const qaDir = path.join(dir, 'qa')
await mkdir(qaDir, { recursive: true })

const events = JSON.parse(await readFile(eventsPath, 'utf8'))
const focus = events.focus || { at: 6, duration: 5, x: 0.5, y: 0.5, zoom: 1.12 }
const start = Number(focus.at)
const holdEnd = start + Number(focus.duration || 5)
const end = holdEnd + 1
const zoom = Math.min(1.18, Math.max(1.04, Number(focus.zoom || 1.12)))
const x = Math.min(0.95, Math.max(0.05, Number(focus.x || 0.5)))
const y = Math.min(0.95, Math.max(0.05, Number(focus.y || 0.5)))
const zexpr = `if(lt(it,${start}),1,if(lt(it,${start + 1}),1+(${zoom}-1)*(it-${start}),if(lt(it,${holdEnd}),${zoom},if(lt(it,${end}),${zoom}-(${zoom}-1)*(it-${holdEnd}),1))))`

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)))
  })
}

const sourceProbe = JSON.parse((await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', raw])).stdout)
const sourceStream = sourceProbe.streams[0]
const sourceAspect = sourceStream.width / sourceStream.height
const baseFilters = Math.abs(sourceAspect - 16 / 9) < 0.03
  ? 'scale=1920:1080:flags=lanczos,fps=30'
  : `crop=${config.capture.crop},scale=1920:1080:flags=lanczos,fps=30`
const vf = `${baseFilters},zoompan=z='${zexpr}':x='clip(${x}*iw-iw/zoom/2,0,iw-iw/zoom)':y='clip(${y}*ih-ih/zoom/2,0,ih-ih/zoom)':d=1:s=1920x1080:fps=30,format=yuv420p`

await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final])
const probe = JSON.parse((await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name,pix_fmt,avg_frame_rate:format=duration,size', '-of', 'json', final])).stdout)
const duration = Number(probe.format.duration)
for (const [label, position] of [['start', 1], ['focus', Math.max(1, start + 1.5)], ['end', Math.max(1, duration - 1)]]) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(position), '-i', final, '-frames:v', '1', path.join(qaDir, `${label}.jpg`)])
}
const sha256 = createHash('sha256').update(await readFile(final)).digest('hex')
const qa = {
  status: events.valid !== false && probe.streams[0].width === 1920 && probe.streams[0].height === 1080 && probe.streams[0].codec_name === 'h264' && probe.streams[0].pix_fmt === 'yuv420p' && duration >= 8 ? 'PASS' : 'FAIL',
  service: service.name,
  route: `${config.baseUrl}${service.route}`,
  continuousCapture: true,
  slideshow: false,
  focus,
  video: { file: path.relative(outputRoot, final), width: probe.streams[0].width, height: probe.streams[0].height, codec: probe.streams[0].codec_name, pixelFormat: probe.streams[0].pix_fmt, frameRate: probe.streams[0].avg_frame_rate, durationSeconds: duration, bytes: Number(probe.format.size), sha256 }
}
const qaPath = path.join(qaDir, 'qa.json')
await writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`)
process.stdout.write(`${qa.status} ${service.id} ${duration.toFixed(2)}s ${final}\n`)
