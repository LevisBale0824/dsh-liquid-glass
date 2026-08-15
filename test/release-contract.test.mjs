import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CLIENT_LAYERS, renderClient } from '../scripts/build-client.mjs'
import { WALLPAPER_CONTENT_HASH, WALLPAPER_HASH_PREFIX, WALLPAPER_ROUTE, ICE_WALLPAPER_CONTENT_HASH, ICE_WALLPAPER_HASH_PREFIX, ICE_WALLPAPER_ROUTE } from '../host.js'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
const plan = await readFile(new URL('../PLAN.md', import.meta.url), 'utf8')
const client = await readFile(new URL('../client.js', import.meta.url), 'utf8')
const constants = await readFile(new URL('../src/client/constants.js', import.meta.url), 'utf8')

test('package version is semver and docs do not claim a stale current version', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.doesNotMatch(readme, /0\.12\.4 treats/)
  assert.doesNotMatch(readme, /or the 0\.12\.4 tarball/)
  assert.doesNotMatch(plan, /与 package\.json 对齐/)
})

test('generated client matches layered sources', async () => {
  assert.equal(client, await renderClient())
})

test('package files include runtime assets and exclude fixtures', () => {
  assert.ok(pkg.files.includes('host.js'))
  assert.ok(pkg.files.includes('client.js'))
  assert.ok(pkg.files.includes('src/client'))
  assert.ok(pkg.files.includes('assets'))
  assert.ok(!pkg.files.includes('test'))
  assert.ok(!pkg.files.includes('docs'))
})

test('wallpaper URL is content-hashed and matches the host route', async () => {
  const bytes = await readFile(new URL('../assets/liquid-glass-deepwater.jpg', import.meta.url))
  const digest = createHash('sha256').update(bytes).digest('hex')
  assert.equal(digest, WALLPAPER_CONTENT_HASH)
  assert.equal(digest.slice(0, 16), WALLPAPER_HASH_PREFIX)
  assert.match(constants, /DEEPWATER_WALLPAPER_HASH = 'b209a409aea86fd6'/)
  assert.equal(WALLPAPER_ROUTE, '/dsh-liquid-glass/assets/liquid-glass-deepwater.b209a409aea86fd6.jpg')
  assert.match(client, /DEEPWATER_WALLPAPER_URL/)
  const iceBytes = await readFile(new URL('../assets/liquid-glass-ice.jpg', import.meta.url))
  const iceDigest = createHash('sha256').update(iceBytes).digest('hex')
  assert.equal(iceDigest, ICE_WALLPAPER_CONTENT_HASH)
  assert.equal(iceDigest.slice(0, 16), ICE_WALLPAPER_HASH_PREFIX)
  assert.match(constants, /ICE_WALLPAPER_HASH = 'f25a2221e0e89107'/)
  assert.equal(ICE_WALLPAPER_ROUTE, '/dsh-liquid-glass/assets/liquid-glass-ice.f25a2221e0e89107.jpg')
  assert.match(client, /ICE_WALLPAPER_URL/)
  assert.match(client, /id: 'ice', css: 'url\("' \+ ICE_WALLPAPER_URL \+ '"\)'/)
})

test('generated fallbacks sit between optics-map and controller-styles', () => {
  assert.ok(CLIENT_LAYERS.indexOf('generated-optics-fallbacks.js') > CLIENT_LAYERS.indexOf('optics-map.js'))
  assert.ok(CLIENT_LAYERS.indexOf('generated-optics-fallbacks.js') < CLIENT_LAYERS.indexOf('controller-styles.js'))
})

test('client layer order stays explicit and deterministic', () => {
  assert.ok(CLIENT_LAYERS.indexOf('runtime-scheduler.js') < CLIENT_LAYERS.indexOf('metal.js'))
  assert.ok(CLIENT_LAYERS.indexOf('runtime-scheduler.js') < CLIENT_LAYERS.indexOf('metrics.js'))
  assert.ok(CLIENT_LAYERS.indexOf('optics-map.js') < CLIENT_LAYERS.indexOf('controller-styles.js'))
  assert.equal(CLIENT_LAYERS.at(-1), 'apply.js')
  assert.equal(new Set(CLIENT_LAYERS).size, CLIENT_LAYERS.length)
})
