import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

export async function loadOptics(options = {}) {
  const constants = await readFile(new URL('../../src/client/constants.js', import.meta.url), 'utf8')
  const sdf = await readFile(new URL('../../src/client/optics-sdf.js', import.meta.url), 'utf8')
  const map = await readFile(new URL('../../src/client/optics-map.js', import.meta.url), 'utf8')
  let now = 0
  const clock = {
    now() { return now },
    set(value) { now = value },
    advance(ms) { now += ms },
  }
  const sandbox = {
    Set,
    Map,
    Math,
    Uint8ClampedArray,
    performance: { now: options.now || (() => clock.now()) },
    requestIdleCallback: options.requestIdleCallback,
    cancelIdleCallback: options.cancelIdleCallback,
    setTimeout: options.setTimeout || setTimeout,
    clearTimeout: options.clearTimeout || clearTimeout,
    FileReader: options.FileReader,
    document: options.document || {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext() { return null },
          toDataURL() { return '' },
        }
      },
    },
    window: options.window || {},
  }
  vm.runInNewContext(
    `${constants}\n${sdf}\n${map}\nthis.api = {\n  createIslandLensPixels: createIslandLensPixels,\n  createIslandLensPixelJob: createIslandLensPixelJob,\n  stepIslandLensPixelJob: stepIslandLensPixelJob,\n  finishIslandLensPixelJob: finishIslandLensPixelJob,\n  cancelIslandLensPixelJob: cancelIslandLensPixelJob,\n  requestIslandLensMap: requestIslandLensMap,\n  peekIslandLensMap: peekIslandLensMap,\n  rememberIslandMap: rememberIslandMap,\n  islandMapSize: islandMapSize,\n  islandLensStateKey: islandLensStateKey,\n  islandLensCacheKey: islandLensCacheKey,\n  ISLAND_LENS: ISLAND_LENS,\n  DISPERSION_SPREAD: DISPERSION_SPREAD,\n  ISLAND_MAP_CACHE_LIMIT: ISLAND_MAP_CACHE_LIMIT,\n  buildIslandFilterPrimitives: buildIslandFilterPrimitives,\n  islandLensRuntime: islandLensRuntime,\n  islandMapPendingJobs: islandMapPendingJobs,\n  islandMapCache: islandMapCache,\n  scheduleIslandPump: scheduleIslandPump,\n}`,
    sandbox,
  )
  return { ...sandbox.api, clock, sandbox }
}

export function samplePixels(pixels, points) {
  const out = {}
  for (const [name, [x, y]] of Object.entries(points)) {
    const i = (y * pixels.width + x) * 4
    out[name] = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2], pixels.data[i + 3]]
  }
  return out
}

export function createWorkingCanvas(stats = {}) {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) } },
        putImageData() {},
      }
    },
    toDataURL() {
      stats.encodes = (stats.encodes || 0) + 1
      return 'data:image/png;base64,ok'
    },
    toBlob: stats.toBlob,
  }
}
