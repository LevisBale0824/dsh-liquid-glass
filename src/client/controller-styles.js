    // Layer: inject the CSS tag and per-island SVG filters.
    function installIslandStyles(id) {
      var tag = document.createElement('style')
      var lens = document.createElement('div')
      var keys = ['sidebar', 'title', 'pane']
      var fallback = {
        sidebar: { w: 244, h: 640, r: 28 },
        title: { w: 720, h: 52, r: 28 },
        pane: { w: 720, h: 560, r: 28 },
      }
      var lensState = {
        sidebar: { key: '', map: '' },
        title: { key: '', map: '' },
        pane: { key: '', map: '' },
      }
      warmIslandFallbackCache()
      var images = {}
      tag.dataset.plugin = name
      tag.dataset.pluginCss = STYLE_ID
      tag.dataset.lgInstance = id
      tag.textContent = String(css)
        .split('url(#lg-island-lens-sidebar)').join('url(#lg-island-lens-' + id + '-sidebar)')
        .split('url(#lg-island-lens-title)').join('url(#lg-island-lens-' + id + '-title)')
        .split('url(#lg-island-lens-pane)').join('url(#lg-island-lens-' + id + '-pane)')
      document.head.append(tag)
      lens.setAttribute('data-lg-island-lens', '')
      lens.setAttribute('aria-hidden', 'true')
      lens.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none'
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0">'
      keys.forEach(function (key) {
        var shape = fallback[key]
        var pre = typeof ISLAND_FALLBACK_MAPS !== 'undefined' ? ISLAND_FALLBACK_MAPS[key] : null
        var map = pre && pre.map ? pre.map : ''
        lensState[key] = { key: islandLensStateKey(shape.w, shape.h), map: map }
        svg += '<filter id="lg-island-lens-' + id + '-' + key + '" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" x="-0.2" y="-0.2" width="1.4" height="1.4" color-interpolation-filters="sRGB">'
          + buildIslandFilterPrimitives(map, islandDisplacementScale())
          + '</filter>'
      })
      svg += '</svg>'
      lens.innerHTML = svg
      document.body.prepend(lens)
      keys.forEach(function (key) {
        images[key] = typeof lens.querySelector === 'function'
          ? lens.querySelector('#lg-island-lens-' + id + '-' + key + ' feImage')
          : null
      })
      var pendingMaps = { sidebar: null, title: null, pane: null }
      var mapEpoch = { sidebar: 0, title: 0, pane: 0 }
      function applyIslandMap(key, nextKey, map) {
        if (!map) return
        lensState[key] = { key: nextKey, map: map }
        var node = images[key]
        if (node === null || node === undefined) return
        node.setAttribute('href', map)
        node.setAttribute('xlink:href', map)
      }
      function syncIslandLenses() {
        if (glassOwners.size === 0 || !readLensRefract()) return
        var shapes = measureIslandShapes()
        if (shapes === null) return
        keys.forEach(function (key) {
          var nextKey = islandLensStateKey(shapes[key].w, shapes[key].h)
          if (nextKey === lensState[key].key) return
          var hit = peekIslandLensMap(shapes[key].w, shapes[key].h)
          if (hit !== null) {
            if (pendingMaps[key] !== null) {
              pendingMaps[key]()
              pendingMaps[key] = null
            }
            lensState[key] = { key: nextKey, map: hit }
            if (hit) applyIslandMap(key, nextKey, hit)
            return
          }
          mapEpoch[key] += 1
          var epoch = mapEpoch[key]
          if (pendingMaps[key] !== null) pendingMaps[key]()
          pendingMaps[key] = requestIslandLensMap(shapes[key].w, shapes[key].h, function (map) {
            pendingMaps[key] = null
            if (epoch !== mapEpoch[key]) return
            applyIslandMap(key, nextKey, map)
          })
        })
      }
      islandLensSyncs.add(syncIslandLenses)
      return function () {
        islandLensSyncs.delete(syncIslandLenses)
        keys.forEach(function (key) {
          mapEpoch[key] += 1
          if (pendingMaps[key] !== null) pendingMaps[key]()
          pendingMaps[key] = null
        })
        tag.remove()
        lens.remove()
      }
    }
