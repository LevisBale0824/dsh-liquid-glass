import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { decodePngDataUrl, hashPixels } from '../scripts/png-codec.mjs'
import { createFakeTimers } from './helpers/client-runtime.mjs'
import { createWorkingCanvas, loadOptics, samplePixels } from './helpers/optics-runtime.mjs'

const GOLDEN = {
  sidebar: {
    box: [244, 640],
    width: 292,
    height: 768,
    hash: 'e6c403e2437548b114c6e5c37735e040ca46950b795511002dff9bcc90d1ec39',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [127, 127, 128, 255],
      edgeMid: [132, 127, 128, 255],
      cornerIn: [128, 128, 128, 255],
    },
  },
  title: {
    box: [720, 52],
    width: 768,
    height: 64,
    hash: '8c2cdcf9dd8175c9d86518998c0ce2be34ad712ca7702bb515e7970803f5b1b9',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [127, 127, 128, 255],
      edgeMid: [133, 127, 128, 255],
      cornerIn: [128, 128, 128, 255],
    },
  },
  pane: {
    box: [720, 560],
    width: 768,
    height: 596,
    hash: '6dd9efef71cce18882e822f0a90a5da450a90d448f075a36182b6b863640698b',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [128, 128, 128, 255],
      edgeMid: [133, 127, 128, 255],
      cornerIn: [128, 128, 128, 255],
    },
  },
  collapsedSidebar: {
    box: [42, 630],
    width: 64,
    height: 768,
    hash: '22e58dd7d0ed355e84d37cfb0eae61532346e72ee455fa287cad5dccec6228c5',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [127, 127, 128, 255],
      edgeMid: [130, 127, 128, 255],
      cornerIn: [133, 133, 128, 255],
    },
  },
  narrowPane: {
    box: [388, 437],
    width: 682,
    height: 768,
    hash: 'ae721881b260199d81c7fcd3966e85de209b2123daf06eedc07531a17ccf1874',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [127, 127, 128, 255],
      edgeMid: [129, 127, 128, 255],
      cornerIn: [128, 128, 128, 255],
    },
  },
  tiny: {
    box: [16, 16],
    width: 768,
    height: 768,
    hash: '0e0067d14b934851056f4a2af53b858855cf621cf45edb9a35abdb5c37634ebf',
    first: [128, 128, 128, 255],
    last: [128, 128, 128, 255],
    samples: {
      topLeft: [128, 128, 128, 255],
      topRight: [128, 128, 128, 255],
      bottomLeft: [128, 128, 128, 255],
      bottomRight: [128, 128, 128, 255],
      mid: [104, 104, 128, 255],
      edgeMid: [128, 127, 128, 255],
      cornerIn: [128, 128, 128, 255],
    },
  },
}

const api = await loadOptics()

function hashPixelBuffer(pixels) {
  return createHash('sha256').update(Buffer.from(pixels.data)).digest('hex')
}

for (const [name, expected] of Object.entries(GOLDEN)) {
  test(`optics golden ${name} ${expected.box[0]}x${expected.box[1]}`, () => {
    const pixels = api.createIslandLensPixels(expected.box[0], expected.box[1])
    assert.equal(pixels.width, expected.width)
    assert.equal(pixels.height, expected.height)
    assert.equal(pixels.data.length, expected.width * expected.height * 4)
    const last = pixels.data.length - 4
    assert.deepEqual([pixels.data[0], pixels.data[1], pixels.data[2], pixels.data[3]], expected.first)
    assert.deepEqual([pixels.data[last], pixels.data[last + 1], pixels.data[last + 2], pixels.data[last + 3]], expected.last)
    assert.deepEqual(samplePixels(pixels, {
      topLeft: [0, 0],
      topRight: [pixels.width - 1, 0],
      bottomLeft: [0, pixels.height - 1],
      bottomRight: [pixels.width - 1, pixels.height - 1],
      mid: [Math.floor(pixels.width / 2), Math.floor(pixels.height / 2)],
      edgeMid: [0, Math.floor(pixels.height / 2)],
      cornerIn: [8, 8],
    }), expected.samples)
    assert.equal(hashPixelBuffer(pixels), expected.hash)
  })
}

test('generated fallbacks decode to the golden pixel hashes', async () => {
  const src = await readFile(new URL('../src/client/generated-optics-fallbacks.js', import.meta.url), 'utf8')
  const maps = Function(`return ${src.slice(src.indexOf('{'))}`)()
  assert.equal(hashPixels(decodePngDataUrl(maps.sidebar.map).data), GOLDEN.sidebar.hash)
  assert.equal(hashPixels(decodePngDataUrl(maps.title.map).data), GOLDEN.title.hash)
  assert.equal(hashPixels(decodePngDataUrl(maps.pane.map).data), GOLDEN.pane.hash)
})

test('pixel jobs yield instead of finishing a large map in one slice', () => {
  const job = api.createIslandLensPixelJob(244, 640)
  const done = api.stepIslandLensPixelJob(job, { timeRemaining() { return 0 } })
  assert.equal(done, false)
  assert.ok(job.y > 0)
  assert.ok(job.y < job.mapH)
  assert.ok(job.yields >= 1)
})

test('cancelling a pixel job stops further work', () => {
  const job = api.createIslandLensPixelJob(244, 640)
  api.cancelIslandLensPixelJob(job)
  assert.equal(api.stepIslandLensPixelJob(job, { timeRemaining() { return 1e6 } }), true)
  assert.equal(job.y, 0)
})

test('idle deadline without timeout processes one row then yields', async () => {
  let t = 0
  const { createIslandLensPixelJob, stepIslandLensPixelJob } = await loadOptics({ now: () => ++t })
  const job = createIslandLensPixelJob(244, 640)
  const done = stepIslandLensPixelJob(job, { didTimeout: false, timeRemaining() { return 0 } })
  assert.equal(done, false)
  assert.equal(job.y, 1)
  assert.ok(job.y < job.mapH)
})

test('didTimeout uses the 4ms budget and still yields', async () => {
  let t = 0
  const { createIslandLensPixelJob, stepIslandLensPixelJob } = await loadOptics({ now: () => ++t })
  const job = createIslandLensPixelJob(244, 640)
  const done = stepIslandLensPixelJob(job, { didTimeout: true, timeRemaining() { return 0 } })
  assert.equal(done, false)
  assert.ok(job.y > 1)
  assert.ok(job.y < job.mapH)
})

test('setTimeout fallback registers idle timeout and processes multiple rows per turn', async () => {
  const timers = createFakeTimers()
  const idleCalls = []
  const stats = {}
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestIdleCallback(fn, options) {
      idleCalls.push(options)
      return timers.setTimeout(() => fn({ didTimeout: true, timeRemaining() { return 0 } }), options?.timeout || 0)
    },
    cancelIdleCallback: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas(stats) } },
  })
  optics.requestIslandLensMap(180, 400, () => {})
  assert.equal(idleCalls.length, 1)
  assert.equal(idleCalls[0].timeout, 500)
})

test('without requestIdleCallback a tall map uses far fewer timers than its height', async () => {
  const timers = createFakeTimers()
  const stats = {}
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas(stats) } },
  })
  let done = false
  optics.requestIslandLensMap(244, 640, () => { done = true })
  let steps = 0
  while (timers.pendingTimeouts() && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  assert.equal(done, true)
  assert.ok(steps < 200)
  assert.ok(optics.islandLensRuntime.jobsYielded >= 1)
})

test('same size requests share one job', async () => {
  const timers = createFakeTimers()
  const stats = {}
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas(stats) } },
  })
  const results = []
  for (let i = 0; i < 20; i++) {
    optics.requestIslandLensMap(188, 400, value => results.push(value))
  }
  assert.equal(optics.islandLensRuntime.jobsStarted, 1)
  assert.equal(optics.islandMapPendingJobs.size, 1)
  let steps = 0
  while (timers.pendingTimeouts() && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  assert.equal(results.length, 20)
  assert.ok(results.every(item => item === results[0] && item))
  assert.equal(optics.islandMapPendingJobs.size, 0)
})

test('cancelling one subscriber leaves the other intact', async () => {
  const timers = createFakeTimers()
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas() } },
  })
  const seen = { a: 0, b: 0 }
  const cancelA = optics.requestIslandLensMap(190, 400, () => { seen.a += 1 })
  optics.requestIslandLensMap(190, 400, () => { seen.b += 1 })
  cancelA()
  let steps = 0
  while (timers.pendingTimeouts() && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  assert.equal(seen.a, 0)
  assert.equal(seen.b, 1)
  assert.equal(optics.islandLensRuntime.jobsCompleted, 1)
})

test('cancelling every subscriber stops the job', async () => {
  const timers = createFakeTimers()
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas() } },
  })
  const seen = []
  const cancels = [
    optics.requestIslandLensMap(191, 400, value => seen.push(value)),
    optics.requestIslandLensMap(191, 400, value => seen.push(value)),
  ]
  cancels.forEach(fn => fn())
  timers.advance(0)
  assert.equal(optics.islandMapPendingJobs.size, 0)
  assert.equal(optics.islandLensRuntime.jobsCompleted, 0)
  assert.equal(seen.length, 0)
  assert.equal(optics.peekIslandLensMap(191, 400), null)
})

test('failed encode is not cached and can be retried', async () => {
  const timers = createFakeTimers()
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: {
      createElement() {
        return { width: 0, height: 0, getContext() { return null }, toDataURL() { return '' } }
      },
    },
  })
  const results = []
  optics.requestIslandLensMap(192, 400, value => results.push(value))
  let steps = 0
  while (timers.pendingTimeouts() && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  assert.deepEqual(results, [''])
  assert.equal(optics.peekIslandLensMap(192, 400), null)
  optics.requestIslandLensMap(192, 400, value => results.push(value))
  assert.equal(optics.islandLensRuntime.jobsStarted, 2)
})

test('successful maps are reused from the LRU', async () => {
  const timers = createFakeTimers()
  const stats = { encodes: 0 }
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    document: { createElement() { return createWorkingCanvas(stats) } },
  })
  const first = []
  optics.requestIslandLensMap(193, 400, value => first.push(value))
  let steps = 0
  while (timers.pendingTimeouts() && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  const created = timers.stats.timeoutsCreated
  const started = optics.islandLensRuntime.jobsStarted
  const second = []
  optics.requestIslandLensMap(193, 400, value => second.push(value))
  assert.equal(second[0], first[0])
  assert.equal(optics.islandLensRuntime.jobsStarted, started)
  assert.equal(timers.stats.timeoutsCreated, created)
})

test('LRU evicts the oldest unused key after 16 entries', () => {
  const optics = api
  const firstKey = optics.islandLensCacheKey(10, 10)
  for (let i = 0; i < 17; i++) {
    optics.rememberIslandMap(optics.islandLensCacheKey(10 + i, 20), `map-${i}`)
  }
  assert.ok(optics.islandMapCache.size <= 16)
  assert.equal(optics.islandMapCache.has(firstKey), false)
})

test('late encode after cancel does not populate the cache', async () => {
  const timers = createFakeTimers()
  let blobCb = null
  const optics = await loadOptics({
    now: (() => { let t = 0; return () => ++t })(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    FileReader: class {
      readAsDataURL() { this.onload?.() }
      abort() {}
    },
    document: {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext() {
            return {
              createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) } },
              putImageData() {},
            }
          },
          toBlob(cb) { blobCb = cb },
        }
      },
    },
  })
  const seen = []
  const cancel = optics.requestIslandLensMap(194, 400, value => seen.push(value))
  let steps = 0
  while (blobCb === null && steps < 400) {
    timers.advance(0)
    steps += 1
  }
  cancel()
  assert.equal(optics.islandMapPendingJobs.size, 0)
  if (blobCb) blobCb({ size: 1 })
  assert.equal(seen.length, 0)
  assert.equal(optics.peekIslandLensMap(194, 400), null)
})

test('lens map size and filter constants stay locked', () => {
  assert.equal(api.ISLAND_LENS.mapSize, 768)
  assert.equal(api.ISLAND_LENS.cornerRadius, 28)
  assert.equal(api.DISPERSION_SPREAD, 0.22)
  const empty = api.buildIslandFilterPrimitives('', 0.14)
  assert.match(empty, /feTurbulence/)
  const filled = api.buildIslandFilterPrimitives('data:image/png;base64,xx', 0.14)
  assert.match(filled, /feImage href="data:image\/png;base64,xx"/)
  assert.match(filled, /feDisplacementMap/)
  assert.match(filled, /feColorMatrix/)
})
