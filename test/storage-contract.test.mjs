import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const constants = await readFile(new URL('../src/client/constants.js', import.meta.url), 'utf8')
const storage = await readFile(new URL('../src/client/storage.js', import.meta.url), 'utf8')
const wallpaper = await readFile(new URL('../src/client/wallpaper-state.js', import.meta.url), 'utf8')

function loadStorage(localStorage) {
  const sandbox = {
    Set,
    Map,
    window: { localStorage },
    Math,
  }
  vm.runInNewContext(
    `${constants}\n${storage}\n${wallpaper}\nthis.api = {\n  saveBackgroundState: saveBackgroundState,\n  readBackgroundState: readBackgroundState,\n  readCustomLibrary: readCustomLibrary,\n  canPersistLibrary: canPersistLibrary,\n  MAX_CUSTOM_BACKGROUNDS: MAX_CUSTOM_BACKGROUNDS,\n  MAX_CUSTOM_LIBRARY_DATA_URL_LENGTH: MAX_CUSTOM_LIBRARY_DATA_URL_LENGTH,\n}`,
    sandbox,
  )
  return sandbox.api
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem(name) { return values.has(name) ? values.get(name) : null },
    setItem(name, value) { values.set(name, String(value)) },
    removeItem(name) { values.delete(name) },
  }
}

test('six small custom images still persist', () => {
  const local = memoryStorage()
  const api = loadStorage(local)
  const library = Array.from({ length: 6 }, (_, i) => ({
    id: `custom-${i}`,
    data: `data:image/jpeg;base64,${'A'.repeat(20 + i)}`,
  }))
  assert.equal(api.saveBackgroundState(library[5].id, library[5].data, 0.88, library), true)
  assert.equal(api.readCustomLibrary().length, 6)
})

test('over-budget library is rejected before any write', () => {
  const local = memoryStorage({
    'dsh-liquid-glass.background': 'ice',
    'dsh-liquid-glass.background.opacity': '0.88',
  })
  const api = loadStorage(local)
  const huge = `data:image/jpeg;base64,${'B'.repeat(3 * 1024 * 1024)}`
  const library = [
    { id: 'custom-a', data: `data:image/jpeg;base64,${'A'.repeat(2 * 1024 * 1024)}` },
    { id: 'custom-b', data: huge },
  ]
  assert.equal(api.canPersistLibrary(library.slice(0, 1), huge), false)
  assert.equal(api.saveBackgroundState('custom-b', huge, 0.88, library), false)
  assert.equal(local.getItem('dsh-liquid-glass.background'), 'ice')
  assert.equal(local.getItem('dsh-liquid-glass.background.customs'), null)
})

test('mid-write quota failure restores every key', () => {
  const local = memoryStorage({
    'dsh-liquid-glass.background': 'ice',
    'dsh-liquid-glass.background.custom': 'data:image/jpeg;base64,old',
    'dsh-liquid-glass.background.customs': JSON.stringify([{ id: 'custom', data: 'data:image/jpeg;base64,old' }]),
    'dsh-liquid-glass.background.opacity': '0.7',
  })
  let writes = 0
  const wrapped = {
    getItem: name => local.getItem(name),
    removeItem: name => local.removeItem(name),
    setItem(name, value) {
      writes += 1
      if (writes === 2) throw new Error('quota')
      local.setItem(name, value)
    },
  }
  const api = loadStorage(wrapped)
  const library = [{ id: 'custom-a', data: 'data:image/jpeg;base64,new' }]
  assert.equal(api.saveBackgroundState('custom-a', library[0].data, 0.9, library), false)
  assert.equal(local.getItem('dsh-liquid-glass.background'), 'ice')
  assert.equal(local.getItem('dsh-liquid-glass.background.custom'), 'data:image/jpeg;base64,old')
  assert.equal(local.getItem('dsh-liquid-glass.background.opacity'), '0.7')
  assert.deepEqual(JSON.parse(local.getItem('dsh-liquid-glass.background.customs')), [
    { id: 'custom', data: 'data:image/jpeg;base64,old' },
  ])
})

test('legacy custom key is still readable', () => {
  const local = memoryStorage({
    'dsh-liquid-glass.background': 'custom',
    'dsh-liquid-glass.background.custom': 'data:image/jpeg;base64,legacy',
  })
  const api = loadStorage(local)
  const state = api.readBackgroundState({ getTheme() { return { active: { colorScheme: 'light' } } } })
  assert.equal(state.id, 'custom')
  assert.equal(state.custom, 'data:image/jpeg;base64,legacy')
  assert.equal(state.customs[0].id, 'custom')
})

test('a later commit that rereads the library keeps the earlier import', () => {
  const local = memoryStorage()
  const api = loadStorage(local)
  assert.equal(api.saveBackgroundState('custom-b', 'data:image/jpeg;base64,bbb', 0.88, [
    { id: 'custom-b', data: 'data:image/jpeg;base64,bbb' },
  ]), true)
  const latest = api.readCustomLibrary()
  latest.push({ id: 'custom-a', data: 'data:image/jpeg;base64,aaa' })
  assert.equal(api.saveBackgroundState('custom-a', 'data:image/jpeg;base64,aaa', 0.88, latest), true)
  assert.equal(JSON.stringify(api.readCustomLibrary().map(item => item.id).sort()), JSON.stringify(['custom-a', 'custom-b']))
})
