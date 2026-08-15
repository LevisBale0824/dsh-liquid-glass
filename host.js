// dsh-liquid-glass —— Node host half
// Serves the bundled preview wallpaper without exposing arbitrary filesystem paths.

import { readFile } from 'node:fs/promises'

export const name = 'dsh-liquid-glass'
export const inject = ['webServer']

export const WALLPAPER_CONTENT_HASH = 'b209a409aea86fd6f572b3ac6025b8370e5e925533215a1414df8e432e5eab31'
export const WALLPAPER_HASH_PREFIX = WALLPAPER_CONTENT_HASH.slice(0, 16)
const WALLPAPER_PATH = new URL('./assets/liquid-glass-deepwater.jpg', import.meta.url)
export const WALLPAPER_ROUTE_LEGACY = '/dsh-liquid-glass/assets/liquid-glass-deepwater.jpg'
export const WALLPAPER_ROUTE = '/dsh-liquid-glass/assets/liquid-glass-deepwater.' + WALLPAPER_HASH_PREFIX + '.jpg'

export const ICE_WALLPAPER_CONTENT_HASH = 'f25a2221e0e8910761b52df1f43b77ec79c8f8b7e917fbdd5ce1696ba921b2eb'
export const ICE_WALLPAPER_HASH_PREFIX = ICE_WALLPAPER_CONTENT_HASH.slice(0, 16)
const ICE_WALLPAPER_PATH = new URL('./assets/liquid-glass-ice.jpg', import.meta.url)
export const ICE_WALLPAPER_ROUTE_LEGACY = '/dsh-liquid-glass/assets/liquid-glass-ice.jpg'
export const ICE_WALLPAPER_ROUTE = '/dsh-liquid-glass/assets/liquid-glass-ice.' + ICE_WALLPAPER_HASH_PREFIX + '.jpg'

export const WALLPAPER_ROUTES = [
  WALLPAPER_ROUTE,
  WALLPAPER_ROUTE_LEGACY,
  ICE_WALLPAPER_ROUTE,
  ICE_WALLPAPER_ROUTE_LEGACY,
]

function createStaticImageHandler({ read, contentHash, hashedRoute }) {
  let cachedBuffer = null
  let inflightRead = null
  const etag = '"' + contentHash + '"'

  function loadImage() {
    if (cachedBuffer !== null) return Promise.resolve(cachedBuffer)
    if (inflightRead !== null) return inflightRead
    inflightRead = Promise.resolve()
      .then(() => read())
      .then((buffer) => {
        cachedBuffer = buffer
        inflightRead = null
        return buffer
      }, (error) => {
        inflightRead = null
        throw error
      })
    return inflightRead
  }

  function requestPath(req) {
    const raw = req && (req.url || req.path) ? String(req.url || req.path) : hashedRoute
    return raw.split('?')[0]
  }

  function cacheControl(path) {
    if (path === hashedRoute) return 'public, max-age=31536000, immutable'
    return 'no-cache, max-age=0, must-revalidate'
  }

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' })
      res.end()
      return
    }
    try {
      const cached = await loadImage()
      const path = requestPath(req)
      const headers = {
        'content-type': 'image/jpeg',
        'cache-control': cacheControl(path),
        'etag': etag,
        'content-length': String(cached.byteLength),
      }
      const match = req.headers && (req.headers['if-none-match'] || req.headers['If-None-Match'])
      if (match === etag) {
        res.writeHead(304, headers)
        res.end()
        return
      }
      res.writeHead(200, headers)
      res.end(req.method === 'HEAD' ? undefined : cached)
    } catch (_error) {
      cachedBuffer = null
      inflightRead = null
      res.writeHead(404)
      res.end()
    }
  }
}

export function createWallpaperHandler(readWallpaper = () => readFile(WALLPAPER_PATH)) {
  return createStaticImageHandler({
    read: readWallpaper,
    contentHash: WALLPAPER_CONTENT_HASH,
    hashedRoute: WALLPAPER_ROUTE,
  })
}

export function createIceWallpaperHandler(readWallpaper = () => readFile(ICE_WALLPAPER_PATH)) {
  return createStaticImageHandler({
    read: readWallpaper,
    contentHash: ICE_WALLPAPER_CONTENT_HASH,
    hashedRoute: ICE_WALLPAPER_ROUTE,
  })
}

export function apply(ctx) {
  const deepwater = createWallpaperHandler()
  const ice = createIceWallpaperHandler()
  const disposers = [
    ...[WALLPAPER_ROUTE, WALLPAPER_ROUTE_LEGACY].map((path) => ctx.webServer.register({
      kind: 'exact',
      path,
      handler: deepwater,
    })),
    ...[ICE_WALLPAPER_ROUTE, ICE_WALLPAPER_ROUTE_LEGACY].map((path) => ctx.webServer.register({
      kind: 'exact',
      path,
      handler: ice,
    })),
  ]
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose()
  })
}
