const { load } = require('./load-typescript.cjs')
module.exports = {
  '@/lib/shodan/slide-image-identity': load('src/lib/shodan/slide-image-identity.ts', { 'node:crypto': require('node:crypto') }),
  '@/lib/shodan/preparation-response': load('src/lib/shodan/preparation-response.ts', { './research-response': load('src/lib/shodan/research-response.ts') }),
  '@/lib/org-profile-version': load('src/lib/org-profile-version.ts'),
}
