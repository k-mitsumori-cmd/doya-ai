const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const imageUrl = 'https://assets.example.com/storage/v1/object/public/doyaslide/generated.png'
const image = Buffer.from('generated slide')
const fetches = []
const uploads = []
const { generateSlideImage } = load('src/lib/shodan/slide-image.ts', {
  '@/lib/doyaslide/generate': { composeSlideImage: async () => ({ imageUrl }) },
  '@/lib/doyaslide/logo': { fetchBuffer: async url => { fetches.push(url); return image } },
  '@/lib/fetch-timeout': { raceTimeout: async (_label, _ms, promise) => promise },
  './storage': { uploadPng: async (path, bytes) => { uploads.push({ path, bytes }) } },
}, { fetch: async () => { throw new Error('unprotected fetch must not run') } })

;(async () => {
  await check('Shodan slide transfer uses the bounded DoyaSlide storage fetcher', async () => {
    const slide = await generateSlideImage('owner', 'prep-1', { title: 'Overview', type: 'cover' }, 0)
    assert.deepEqual(fetches, [imageUrl])
    assert.equal(uploads.length, 1)
    assert.equal(uploads[0].bytes, image)
    assert.equal(slide.imagePath, uploads[0].path)
    assert.equal(slide.title, 'Overview')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
