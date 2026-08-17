import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { applyPlugin, createLiveReact, findBy, loadClient, mockTheme } from './helpers/client-runtime.mjs'

const constants = await readFile(new URL('../src/client/constants.js', import.meta.url), 'utf8')
const i18n = await readFile(new URL('../src/client/i18n.js', import.meta.url), 'utf8')
const importer = await readFile(new URL('../src/client/settings-import.js', import.meta.url), 'utf8')
const cropView = await readFile(new URL('../src/client/crop-view.js', import.meta.url), 'utf8')

function loadEncoder(options = {}) {
  const revoked = []
  const listeners = new Map()
  const canvasLog = []
  const url = {
    createObjectURL() { return 'blob:test' },
    revokeObjectURL(value) { revoked.push(value) },
  }
  function Image() {
    this.onload = null
    this.onerror = null
    this.naturalWidth = options.naturalWidth ?? 10
    this.naturalHeight = options.naturalHeight ?? 10
    Object.defineProperty(this, 'src', {
      set: () => { options.onSrc?.(this) },
    })
  }
  const document = {
    visibilityState: 'visible',
    documentElement: { lang: 'zh-CN' },
    addEventListener(name, fn) { listeners.set(name, fn) },
    removeEventListener(name) { listeners.delete(name) },
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            fillRect() {},
            drawImage() {},
          }
        },
        toDataURL(type, quality) {
          canvasLog.push({ type, quality, width: this.width, height: this.height })
          if (options.dataUrl) return options.dataUrl(this)
          return type === 'image/png'
            ? 'data:image/png;base64,' + 'B'.repeat(32)
            : 'data:image/jpeg;base64,' + 'A'.repeat(32)
        },
      }
    },
  }
  const sandbox = {
    Set,
    Map,
    Math,
    URL: url,
    Image,
    document,
    navigator: { language: 'zh-CN' },
    requestIdleCallback: options.requestIdleCallback,
    cancelIdleCallback: options.cancelIdleCallback,
  }
  vm.runInNewContext(`${constants}\n${i18n}\n${importer}\nthis.encodeImageFile = encodeImageFile\nthis.encodeImageRegion = encodeImageRegion\nthis.loadImageFile = loadImageFile`, sandbox)
  return {
    encodeImageFile: sandbox.encodeImageFile,
    encodeImageRegion: sandbox.encodeImageRegion,
    loadImageFile: sandbox.loadImageFile,
    revoked,
    listeners,
    document,
    url,
    canvasLog,
  }
}

test('hidden page before load rejects and revokes the object URL once', async () => {
  const run = loadEncoder({
    onSrc(image) {
      run.document.visibilityState = 'hidden'
      run.listeners.get('visibilitychange')()
      if (image.onload) image.onload()
    },
  })
  await assert.rejects(() => run.encodeImageFile({ type: 'image/jpeg', name: 'a.jpg', size: 12 }))
  assert.deepEqual(run.revoked, ['blob:test'])
  assert.equal(run.listeners.has('visibilitychange'), false)
})

test('hidden page after load and before idle rejects the pending encode', async () => {
  let idle
  const run = loadEncoder({
    requestIdleCallback(fn) { idle = fn; return 7 },
    cancelIdleCallback() { idle = null },
    onSrc(image) { image.onload() },
  })
  const pending = run.encodeImageFile({ type: 'image/jpeg', name: 'a.jpg', size: 12 })
  await new Promise(resolve => setImmediate(resolve))
  run.document.visibilityState = 'hidden'
  run.listeners.get('visibilitychange')()
  await assert.rejects(() => pending)
  assert.equal(idle, null)
  assert.deepEqual(run.revoked, ['blob:test'])
})

test('abort signal settles the promise without leaking listeners', async () => {
  const controller = new AbortController()
  const run = loadEncoder({
    requestIdleCallback() { return 1 },
    cancelIdleCallback() {},
    onSrc(image) { image.onload() },
  })
  const pending = run.encodeImageFile({ type: 'image/jpeg', name: 'a.jpg', size: 12 }, controller.signal)
  controller.abort()
  await assert.rejects(pending, /AbortError/)
  assert.equal(run.listeners.has('visibilitychange'), false)
  assert.deepEqual(run.revoked, ['blob:test'])
})

test('encode keeps the original resolution when the data URL fits the budget', async () => {
  const run = loadEncoder({
    naturalWidth: 4000,
    naturalHeight: 3000,
    onSrc(image) { image.onload() },
  })
  const data = await run.encodeImageFile({ type: 'image/jpeg', name: 'big.jpg', size: 12 })
  assert.match(data, /^data:image\/jpeg/)
  assert.equal(run.canvasLog[0].type, 'image/jpeg')
  assert.equal(run.canvasLog[0].quality, 0.92)
  assert.equal(run.canvasLog[0].width, 4000)
  assert.equal(run.canvasLog[0].height, 3000)
})

test('png sources stay lossless png with alpha preserved', async () => {
  const run = loadEncoder({
    onSrc(image) { image.onload() },
  })
  const data = await run.encodeImageFile({ type: 'image/png', name: 'a.png', size: 12 })
  assert.match(data, /^data:image\/png/)
  assert.equal(run.canvasLog[0].type, 'image/png')
})

test('ladder downscales only when the budget requires it', async () => {
  const run = loadEncoder({
    naturalWidth: 4000,
    naturalHeight: 3000,
    dataUrl(canvas) {
      return canvas.width >= 2000
        ? 'data:image/jpeg;base64,' + 'A'.repeat(2 * 1024 * 1024 + 10)
        : 'data:image/jpeg;base64,' + 'B'.repeat(64)
    },
    onSrc(image) { image.onload() },
  })
  const data = await run.encodeImageFile({ type: 'image/jpeg', name: 'big.jpg', size: 12 })
  assert.match(data, /B{64}/)
  // The first attempt keeps the original resolution; only later attempts downscale.
  assert.equal(run.canvasLog[0].width, 4000)
  assert.ok(run.canvasLog.some(entry => entry.width < 2000))
  assert.ok(run.canvasLog.length > 1)
})

test('a region encode crops to the requested source rectangle at full resolution', async () => {
  const run = loadEncoder({
    naturalWidth: 4000,
    naturalHeight: 2000,
    onSrc(image) { image.onload() },
  })
  const fakeImage = { naturalWidth: 4000, naturalHeight: 2000 }
  const data = await run.encodeImageRegion(fakeImage, { x: 1000, y: 500, w: 2000, h: 1000 }, 'image/jpeg')
  assert.match(data, /^data:image\/jpeg/)
  assert.equal(run.canvasLog[0].width, 2000)
  assert.equal(run.canvasLog[0].height, 1000)
})

function mountSettingsRow(options = {}) {
  const revoked = []
  const idles = []
  const images = []
  const live = createLiveReact()
  function Image() {
    this.onload = null
    this.onerror = null
    this.naturalWidth = 20
    this.naturalHeight = 20
    images.push(this)
    Object.defineProperty(this, 'src', { set() {} })
  }
  const { plugin, context } = loadClient(live.React, options.storage || new Map(), {
    Image,
    URL: {
      createObjectURL() { return 'blob:settings' },
      revokeObjectURL(value) { revoked.push(value) },
    },
    requestIdleCallback(fn) {
      const id = idles.length + 1
      idles.push({ id, fn })
      return id
    },
    cancelIdleCallback(id) {
      const index = idles.findIndex(item => item.id === id)
      if (index >= 0) idles.splice(index, 1)
    },
    createCanvas: options.createCanvas,
  })
  const { entries } = applyPlugin(plugin, mockTheme())
  const settings = entries.find(item => item.entry.options.name === 'settings.general.item')
  const wrapped = settings.entry.component({})
  const controller = wrapped.props.controller
  live.mount(() => {
    const w = settings.entry.component({})
    return w.type(w.props)
  })
  return {
    live,
    context,
    plugin,
    controller,
    entries,
    revoked,
    images,
    get idle() { return idles[idles.length - 1]?.fn || null },
    runIdle(order = 'shift') {
      const item = order === 'pop' ? idles.pop() : idles.shift()
      if (item) item.fn()
    },
    render() {
      return live.rerender()
    },
    bag() { return live.states[1] },
    input() { return findBy(live.tree, node => node?.props?.type === 'file') },
    storage: context.window.localStorage.values,
  }
}

function pick(row, file) {
  const input = { files: [file], value: file.name }
  row.input().props.onChange({ currentTarget: input, target: input })
  return input
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('unmounting SettingsRow closes an open crop session and revokes the object URL', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'same.jpg', size: 20, lastModified: 1 }
  pick(row, file)
  row.images[0].onload()
  await flush()
  assert.ok(row.controller.getCropSession())
  assert.deepEqual(row.revoked, [])
  row.live.dispose()
  assert.equal(row.controller.getCropSession(), null)
  assert.deepEqual(row.revoked, ['blob:settings'])
})

test('a failed image load clears lastStamp so the same file can retry', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'same.jpg', size: 20, lastModified: 2 }
  const input = pick(row, file)
  row.images[0].onerror()
  await flush()
  assert.equal(row.bag().lastStamp, '')
  assert.equal(input.value, '')
  pick(row, file)
  assert.equal(row.images.length, 2)
})

test('hidden page failure does not stay in processing and allows retry', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'same.jpg', size: 20, lastModified: 3 }
  pick(row, file)
  row.context.document.visibilityState = 'hidden'
  row.context.document.dispatch('visibilitychange')
  await flush()
  const tree = row.render()
  assert.doesNotMatch(JSON.stringify(tree), /正在处理图片/)
  assert.equal(row.bag().lastStamp, '')
})

test('confirming a crop commits the region to the library', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'a.jpg', size: 20, lastModified: 4 }
  pick(row, file)
  row.images[0].onload()
  await flush()
  const session = row.controller.getCropSession()
  assert.ok(session)
  session.commit({ x: 0, y: 0, w: 20, h: 20 })
  row.runIdle()
  for (let i = 0; i < 8; i++) await flush()
  const library = JSON.parse(row.storage.get('dsh-liquid-glass.background.customs') || '[]')
  assert.equal(library.length, 1)
  assert.equal(row.controller.getCropSession(), null)
  assert.deepEqual(row.revoked, ['blob:settings'])
})

test('cancelling a crop revokes, clears lastStamp, and keeps the library empty', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'b.jpg', size: 20, lastModified: 5 }
  pick(row, file)
  row.images[0].onload()
  await flush()
  const session = row.controller.getCropSession()
  assert.ok(session)
  session.cancel()
  await flush()
  assert.equal(row.bag().lastStamp, '')
  assert.equal(row.controller.getCropSession(), null)
  assert.equal(row.storage.get('dsh-liquid-glass.background.customs'), undefined)
  assert.deepEqual(row.revoked, ['blob:settings'])
})

test('two imports finishing in reverse order both persist', async () => {
  const row = mountSettingsRow()
  const a = { type: 'image/jpeg', name: 'a.jpg', size: 20, lastModified: 6 }
  const b = { type: 'image/jpeg', name: 'b.jpg', size: 21, lastModified: 7 }
  pick(row, a)
  row.images[0].onload()
  await flush()
  const sessionA = row.controller.getCropSession()
  sessionA.commit({ x: 0, y: 0, w: 20, h: 20 })
  pick(row, b)
  row.images[1].onload()
  await flush()
  const sessionB = row.controller.getCropSession()
  sessionB.commit({ x: 0, y: 0, w: 20, h: 20 })
  row.runIdle('pop')
  for (let i = 0; i < 8; i++) await flush()
  row.runIdle('shift')
  for (let i = 0; i < 8; i++) await flush()
  const library = JSON.parse(row.storage.get('dsh-liquid-glass.background.customs') || '[]')
  assert.equal(library.length, 2)
})

test('unmounting after confirm but before commit skips storage writes', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'late.jpg', size: 20, lastModified: 8 }
  pick(row, file)
  row.images[0].onload()
  await flush()
  const session = row.controller.getCropSession()
  session.commit({ x: 0, y: 0, w: 20, h: 20 })
  row.live.dispose()
  await flush()
  await flush()
  assert.equal(row.storage.get('dsh-liquid-glass.background.customs'), undefined)
})

function loadCropGeometry() {
  const sandbox = { Math, Set, Map }
  vm.runInNewContext(`${cropView}\nthis.geom = { clampCropRect, moveCropRect, resizeCropRect, fitAspectRect, rectToSource }`, sandbox)
  return sandbox.geom
}

test('crop geometry clamps, moves, resizes freely, and locks aspect ratios', () => {
  const geom = loadCropGeometry()
  const j = value => JSON.stringify(value)
  assert.equal(j(geom.moveCropRect({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 0.3, -0.1)), j({ x: 0.5, y: 0.1, w: 0.4, h: 0.4 }))
  assert.equal(j(geom.moveCropRect({ x: 0.8, y: 0.2, w: 0.4, h: 0.4 }, 0.5, 0)), j({ x: 0.6, y: 0.2, w: 0.4, h: 0.4 }))
  const grown = geom.resizeCropRect({ x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, 'se', 0.2, 0.2, null)
  assert.equal(j(grown), j({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }))
  const locked = geom.resizeCropRect({ x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, 'se', 0.2, 0.2, 1)
  assert.ok(Math.abs(locked.w - locked.h) < 1e-9)
  const original = geom.fitAspectRect({ x: 0, y: 0, w: 1, h: 1 }, 16 / 9)
  assert.ok(Math.abs(original.w / original.h - 16 / 9) < 1e-9)
  const source = geom.rectToSource({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 4000, 2000)
  assert.equal(j(source), j({ x: 1000, y: 1000, w: 2000, h: 500 }))
})

test('crop overlay renders for an open session and confirm/cancel wire to the session', async () => {
  const row = mountSettingsRow()
  const file = { type: 'image/jpeg', name: 'c.jpg', size: 20, lastModified: 9 }
  pick(row, file)
  row.images[0].onload()
  await flush()
  assert.ok(row.controller.getCropSession())
  const overlay = row.entries.find(item => item.entry.options.name === 'shell.overlay' && String(item.entry.options.id).indexOf('liquid-glass-crop') === 0)
  assert.ok(overlay)
  const tree = overlay.entry.component({})
  assert.ok(findBy(tree, node => node?.props && 'data-liquid-glass-crop' in node.props))
  assert.ok(findBy(tree, node => node?.props && 'data-liquid-glass-crop-confirm' in node.props))
  assert.ok(findBy(tree, node => node?.props && 'data-liquid-glass-crop-cancel' in node.props))
  assert.ok(findBy(tree, node => node?.props && 'data-liquid-glass-crop-aspect' in node.props))
})
