import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { apply, name, inject, createWallpaperHandler, createIceWallpaperHandler, WALLPAPER_ROUTE, WALLPAPER_ROUTE_LEGACY, WALLPAPER_HASH_PREFIX, WALLPAPER_CONTENT_HASH, ICE_WALLPAPER_ROUTE, ICE_WALLPAPER_ROUTE_LEGACY, ICE_WALLPAPER_HASH_PREFIX, ICE_WALLPAPER_CONTENT_HASH, WALLPAPER_ROUTES } from '../host.js'

test('host plugin is a named function plugin', () => {
  assert.equal(name, 'dsh-liquid-glass')
  assert.deepEqual(inject, ['webServer'])
})

function mockResponse() {
  return {
    status: 0,
    headers: {},
    body: undefined,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers || {}
    },
    end(body) {
      this.body = body
    },
  }
}

function mount() {
  let disposed = 0
  const paths = []
  const byPath = new Map()
  const ctx = {
    webServer: {
      register({ kind, path, handler: next }) {
        assert.equal(kind, 'exact')
        paths.push(path)
        byPath.set(path, next)
        return () => { disposed += 1 }
      },
    },
    effect(factory) {
      const dispose = factory()
      return () => { dispose() }
    },
  }
  apply(ctx)
  assert.deepEqual(paths, WALLPAPER_ROUTES)
  assert.match(WALLPAPER_ROUTE, new RegExp(`liquid-glass-deepwater\\.${WALLPAPER_HASH_PREFIX}\\.jpg$`))
  assert.match(ICE_WALLPAPER_ROUTE, new RegExp(`liquid-glass-ice\\.${ICE_WALLPAPER_HASH_PREFIX}\\.jpg$`))
  return {
    handler: byPath.get(WALLPAPER_ROUTE),
    iceHandler: byPath.get(ICE_WALLPAPER_ROUTE),
    isDisposed: () => disposed === paths.length,
  }
}

test('GET returns the bundled JPEG', async () => {
  const { handler, iceHandler } = mount()
  const res = mockResponse()
  await handler({ method: 'GET' }, res)
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'image/jpeg')
  assert.match(res.headers['cache-control'], /immutable/)
  const file = await readFile(new URL('../assets/liquid-glass-deepwater.jpg', import.meta.url))
  assert.equal(res.body.byteLength, file.byteLength)
  const ice = mockResponse()
  await iceHandler({ method: 'GET', url: ICE_WALLPAPER_ROUTE }, ice)
  assert.equal(ice.status, 200)
  assert.equal(ice.headers['content-type'], 'image/jpeg')
  assert.match(ice.headers['cache-control'], /immutable/)
  const iceFile = await readFile(new URL('../assets/liquid-glass-ice.jpg', import.meta.url))
  assert.equal(ice.body.byteLength, iceFile.byteLength)
})

test('HEAD returns headers without a body', async () => {
  const { handler } = mount()
  const res = mockResponse()
  await handler({ method: 'HEAD' }, res)
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'image/jpeg')
  assert.equal(res.body, undefined)
})

test('POST is rejected with Allow: GET, HEAD', async () => {
  const { handler } = mount()
  const res = mockResponse()
  await handler({ method: 'POST' }, res)
  assert.equal(res.status, 405)
  assert.equal(res.headers.allow, 'GET, HEAD')
})

test('disposer unregisters the route', () => {
  let disposed = false
  const ctx = {
    webServer: {
      register() { return () => { disposed = true } },
    },
    effect(factory) {
      const dispose = factory()
      dispose()
    },
  }
  apply(ctx)
  assert.equal(disposed, true)
})

test('missing wallpaper file returns 404 without renaming the asset', async () => {
  const handler = createWallpaperHandler(async () => {
    throw new Error('ENOENT')
  })
  const res = mockResponse()
  await handler({ method: 'GET' }, res)
  assert.equal(res.status, 404)
  const file = await readFile(new URL('../assets/liquid-glass-deepwater.jpg', import.meta.url))
  assert.ok(file.byteLength > 0)
  const ice = await readFile(new URL('../assets/liquid-glass-ice.jpg', import.meta.url))
  assert.ok(ice.byteLength > 0)
})

test('20 concurrent first reads hit the file once', async () => {
  let reads = 0
  const handler = createWallpaperHandler(async () => {
    reads += 1
    await new Promise(resolve => setTimeout(resolve, 20))
    return Buffer.from('jpeg')
  })
  const responses = Array.from({ length: 20 }, () => mockResponse())
  await Promise.all(responses.map(res => handler({ method: 'GET' }, res)))
  assert.equal(reads, 1)
  for (const res of responses) {
    assert.equal(res.status, 200)
    assert.equal(res.body.byteLength, 4)
  }
})

test('hashed and legacy routes use different cache policies', async () => {
  const handler = createWallpaperHandler(async () => Buffer.from('jpeg'))
  const hashed = mockResponse()
  await handler({ method: 'GET', url: WALLPAPER_ROUTE }, hashed)
  assert.match(hashed.headers['cache-control'], /immutable/)
  const legacy = mockResponse()
  await handler({ method: 'GET', url: WALLPAPER_ROUTE_LEGACY }, legacy)
  assert.doesNotMatch(legacy.headers['cache-control'], /immutable/)
  assert.match(legacy.headers['cache-control'], /no-cache/)
  const iceHandler = createIceWallpaperHandler(async () => Buffer.from('ice'))
  const iceHashed = mockResponse()
  await iceHandler({ method: 'GET', url: ICE_WALLPAPER_ROUTE }, iceHashed)
  assert.match(iceHashed.headers['cache-control'], /immutable/)
  const iceLegacy = mockResponse()
  await iceHandler({ method: 'GET', url: ICE_WALLPAPER_ROUTE_LEGACY }, iceLegacy)
  assert.doesNotMatch(iceLegacy.headers['cache-control'], /immutable/)
  assert.match(iceLegacy.headers['cache-control'], /no-cache/)
})

test('ETag match returns 304 without a body', async () => {
  const handler = createWallpaperHandler(async () => Buffer.from('jpeg'))
  const first = mockResponse()
  await handler({ method: 'GET', url: WALLPAPER_ROUTE }, first)
  const again = mockResponse()
  await handler({
    method: 'GET',
    url: WALLPAPER_ROUTE,
    headers: { 'if-none-match': first.headers.etag },
  }, again)
  assert.equal(again.status, 304)
  assert.equal(again.body, undefined)
  assert.equal(first.headers.etag, `"${WALLPAPER_CONTENT_HASH}"`)
  const iceHandler = createIceWallpaperHandler(async () => Buffer.from('ice'))
  const iceFirst = mockResponse()
  await iceHandler({ method: 'GET', url: ICE_WALLPAPER_ROUTE }, iceFirst)
  const iceAgain = mockResponse()
  await iceHandler({
    method: 'GET',
    url: ICE_WALLPAPER_ROUTE,
    headers: { 'if-none-match': iceFirst.headers.etag },
  }, iceAgain)
  assert.equal(iceAgain.status, 304)
  assert.equal(iceFirst.headers.etag, `"${ICE_WALLPAPER_CONTENT_HASH}"`)
})

test('hashed and legacy concurrent reads share one file load', async () => {
  let reads = 0
  const handler = createWallpaperHandler(async () => {
    reads += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return Buffer.from('jpeg')
  })
  const responses = []
  for (let i = 0; i < 10; i++) {
    responses.push(handler({ method: 'GET', url: WALLPAPER_ROUTE }, mockResponse()))
    responses.push(handler({ method: 'GET', url: WALLPAPER_ROUTE_LEGACY }, mockResponse()))
  }
  await Promise.all(responses)
  assert.equal(reads, 1)
})

test('a failed first read can succeed on retry', async () => {
  let reads = 0
  const handler = createWallpaperHandler(async () => {
    reads += 1
    if (reads === 1) throw new Error('ENOENT')
    return Buffer.from('jpeg')
  })
  const fail = mockResponse()
  await handler({ method: 'GET' }, fail)
  assert.equal(fail.status, 404)
  const ok = mockResponse()
  await handler({ method: 'GET' }, ok)
  assert.equal(ok.status, 200)
  assert.equal(ok.body.byteLength, 4)
  const head = mockResponse()
  await handler({ method: 'HEAD' }, head)
  assert.equal(head.status, 200)
  assert.equal(head.body, undefined)
  assert.equal(reads, 2)
})
