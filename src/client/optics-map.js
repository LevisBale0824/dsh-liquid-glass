    // Layer: build the per-island displacement PNG.
    var ISLAND_MAP_CACHE_LIMIT = 16
    var ISLAND_LENS_SLICE_MS = 4
    var islandMapCache = new Map()
    var islandMapPendingJobs = new Map()
    var islandLensRuntime = {
      syncPixelBuilds: 0,
      jobsStarted: 0,
      jobsYielded: 0,
      jobsCompleted: 0,
      encodeFails: 0,
    }
    if (typeof window !== 'undefined') window.__lgIslandLensRuntime = islandLensRuntime

    function islandMapSize(boxW, boxH) {
      var maxSide = ISLAND_LENS.mapSize
      var w = Math.max(8, boxW)
      var h = Math.max(8, boxH)
      var mapW
      var mapH
      if (w >= h) {
        mapW = maxSide
        mapH = Math.max(64, Math.round(maxSide * h / w))
      } else {
        mapH = maxSide
        mapW = Math.max(64, Math.round(maxSide * w / h))
      }
      return { w: mapW & ~1, h: mapH & ~1 }
    }

    function islandLensStateKey(boxW, boxH) {
      return Math.round(boxW) + 'x' + Math.round(boxH)
    }

    function islandLensCacheKey(boxW, boxH) {
      return islandLensStateKey(boxW, boxH)
        + ':r' + ISLAND_LENS.cornerRadius
        + ':m' + ISLAND_LENS.mapSize
        + ':v1'
    }

    function nowMs() {
      return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    }

    function createIslandLensPixelJob(boxW, boxH) {
      var dim = islandMapSize(boxW, boxH)
      var mapW = dim.w
      var mapH = dim.h
      var data = new Uint8ClampedArray(mapW * mapH * 4)
      var inset = 2
      var halfW = Math.max(4, Math.max(8, boxW) / 2 - inset)
      var halfH = Math.max(4, Math.max(8, boxH) / 2 - inset)
      var radius = Math.max(1, Math.min(ISLAND_LENS.cornerRadius, halfW, halfH))
      var minHalf = Math.min(halfW, halfH)
      var depthPx = Math.min(ISLAND_LENS.depthPx, minHalf - 1)
      var innerHalfW = Math.max(0, halfW - depthPx)
      var innerHalfH = Math.max(0, halfH - depthPx)
      var innerRadius = Math.max(0, Math.min(radius, Math.min(innerHalfW, innerHalfH)))
      var falloff = depthPx > 0 ? Math.SQRT1_2 / depthPx : 1e6
      var cap = Math.max(0.01, Math.min(ISLAND_LENS.curvature * minHalf, minHalf - 1))
      var Rx = (halfW * halfW + cap * cap) / (2 * cap)
      var Ry = (halfH * halfH + cap * cap) / (2 * cap)
      var meanX = (Rx - Math.sqrt(Math.max(0, Rx * Rx - halfW * halfW))) / halfW
      var meanY = (Ry - Math.sqrt(Math.max(0, Ry * Ry - halfH * halfH))) / halfH
      var scaleX = meanX > 0 ? 0.5 / meanX : 1
      var scaleY = meanY > 0 ? 0.5 / meanY : 1
      var fxOf = new Array(mapW)
      var fyOf = new Array(mapH)
      var x
      var y
      for (x = 0; x < mapW; x++) fxOf[x] = ((x + 0.5) / mapW - 0.5) * 2 * halfW
      for (y = 0; y < mapH; y++) fyOf[y] = ((y + 0.5) / mapH - 0.5) * 2 * halfH
      return {
        boxW: boxW,
        boxH: boxH,
        mapW: mapW,
        mapH: mapH,
        data: data,
        y: 0,
        i: 0,
        cancelled: false,
        done: false,
        yields: 0,
        halfW: halfW,
        halfH: halfH,
        radius: radius,
        innerHalfW: innerHalfW,
        innerHalfH: innerHalfH,
        innerRadius: innerRadius,
        falloff: falloff,
        rMaxX: Rx * (1 - 1e-3),
        rMaxY: Ry * (1 - 1e-3),
        Rx: Rx,
        Ry: Ry,
        scaleX: scaleX,
        scaleY: scaleY,
        erInv: 1 / Math.max(2, ISLAND_LENS.bendPx),
        edgeInv: 1 / Math.max(2, ISLAND_LENS.sheenWidth),
        glowReachInv: 1 / Math.max(2, ISLAND_LENS.glowSpread * minHalf),
        cosA: Math.cos((ISLAND_LENS.sheenAngle * Math.PI) / 180),
        sinA: Math.sin((ISLAND_LENS.sheenAngle * Math.PI) / 180),
        sheenNorm: Math.SQRT1_2,
        needSpec: ISLAND_LENS.sheen > 0 || ISLAND_LENS.glow > 0,
        bendOn: ISLAND_LENS.bend > 0,
        fxOf: fxOf,
        fyOf: fyOf,
      }
    }

    function paintIslandLensRow(job) {
      var y = job.y
      var fy = job.fyOf[y]
      var mapW = job.mapW
      var data = job.data
      var i = job.i
      var x
      for (x = 0; x < mapW; x++) {
        var fx = job.fxOf[x]
        var sdf = sdRoundBox(fx, fy, job.halfW, job.halfH, job.radius)
        if (sdf >= 0) {
          data[i] = 128
          data[i + 1] = 128
          data[i + 2] = 128
          data[i + 3] = 255
          i += 4
          continue
        }
        var ax = Math.min(Math.abs(fx), job.rMaxX)
        var ay = Math.min(Math.abs(fy), job.rMaxY)
        var dirX = domeGradient(ax, job.Rx, job.scaleX)
        var dirY = domeGradient(ay, job.Ry, job.scaleY)
        if (fx < 0) dirX = -dirX
        if (fy < 0) dirY = -dirY
        var innerSdf = sdRoundBox(fx, fy, job.innerHalfW, job.innerHalfH, job.innerRadius)
        var edgeOpacity = 0.5 * (1 + erfApprox(innerSdf * job.falloff))
        var rimFade = Math.max(0, Math.min(1, -sdf / ISLAND_LENS.rimFadePx))
        rimFade = rimFade * rimFade * (3 - 2 * rimFade)
        var dx = 0.5 * dirX * edgeOpacity * rimFade
        var dy = 0.5 * dirY * edgeOpacity * rimFade
        if (job.bendOn) {
          var s = Math.max(0, 1 + sdf * job.erInv)
          if (s > 0 && rimFade > 0) {
            var nx = (sdRoundBox(fx + 1, fy, job.halfW, job.halfH, job.radius) - sdRoundBox(fx - 1, fy, job.halfW, job.halfH, job.radius)) * 0.5
            var ny = (sdRoundBox(fx, fy + 1, job.halfW, job.halfH, job.radius) - sdRoundBox(fx, fy - 1, job.halfW, job.halfH, job.radius)) * 0.5
            var nlen = Math.sqrt(nx * nx + ny * ny) || 1
            var m = s * s * rimFade
            var a = (0.5 * ISLAND_LENS.bend * m) / nlen
            dx += nx * a
            dy += ny * a
          }
        }
        var spec = 0
        if (job.needSpec) {
          var invW = 1 / job.halfW
          var invH = 1 / job.halfH
          var normX = Math.max(-1, Math.min(1, fx * invW))
          var normY = Math.max(-1, Math.min(1, fy * invH))
          var axis = Math.min(1, Math.abs(normX * job.cosA + normY * job.sinA) * job.sheenNorm)
          if (ISLAND_LENS.sheen > 0) {
            var band = Math.max(0, 1 + sdf * job.edgeInv)
            spec += ISLAND_LENS.sheen * Math.pow(band, ISLAND_LENS.sheenFalloff) * (0.16 + 0.84 * Math.pow(axis, 1.6))
          }
          if (ISLAND_LENS.glow > 0) {
            var reach = Math.min(1, -sdf * job.glowReachInv)
            var t = 1 - reach
            spec += ISLAND_LENS.glow * Math.pow(t * t * (3 - 2 * t), ISLAND_LENS.glowFalloff) * edgeOpacity * (0.6 + 0.4 * axis)
          }
          if (spec > 1) spec = 1
        }
        data[i] = encodeAxis(-dx)
        data[i + 1] = encodeAxis(-dy)
        data[i + 2] = encodeSpec(spec)
        data[i + 3] = 255
        i += 4
      }
      job.i = i
      job.y += 1
    }

    function stepIslandLensPixelJob(job, deadline) {
      if (job.cancelled || job.done) return true
      var started = nowMs()
      var first = job.y
      var honorIdle = deadline
        && deadline.didTimeout !== true
        && typeof deadline.timeRemaining === 'function'
      while (job.y < job.mapH) {
        if (job.y > first) {
          if (nowMs() - started >= ISLAND_LENS_SLICE_MS) {
            job.yields += 1
            islandLensRuntime.jobsYielded += 1
            return false
          }
          if (honorIdle && deadline.timeRemaining() <= 0) {
            job.yields += 1
            islandLensRuntime.jobsYielded += 1
            return false
          }
        }
        paintIslandLensRow(job)
      }
      job.done = true
      return true
    }

    function finishIslandLensPixelJob(job) {
      return { width: job.mapW, height: job.mapH, data: job.data }
    }

    function cancelIslandLensPixelJob(job) {
      job.cancelled = true
    }

    function createIslandLensPixels(boxW, boxH) {
      islandLensRuntime.syncPixelBuilds += 1
      var job = createIslandLensPixelJob(boxW, boxH)
      while (!stepIslandLensPixelJob(job, { timeRemaining: function () { return 1e6 } })) {}
      return finishIslandLensPixelJob(job)
    }

    function rememberIslandMap(key, map) {
      if (!map) return map
      if (islandMapCache.has(key)) islandMapCache.delete(key)
      islandMapCache.set(key, map)
      if (islandMapCache.size > ISLAND_MAP_CACHE_LIMIT) {
        islandMapCache.delete(islandMapCache.keys().next().value)
      }
      return map
    }

    function peekIslandLensMap(boxW, boxH) {
      var key = islandLensCacheKey(boxW, boxH)
      if (!islandMapCache.has(key)) return null
      return rememberIslandMap(key, islandMapCache.get(key))
    }

    function warmIslandFallbackCache() {
      if (typeof ISLAND_FALLBACK_MAPS === 'undefined') return
      var names = ['sidebar', 'title', 'pane']
      for (var i = 0; i < names.length; i++) {
        var item = ISLAND_FALLBACK_MAPS[names[i]]
        if (!item || !item.map || !item.key) continue
        var parts = String(item.key).split('x')
        rememberIslandMap(islandLensCacheKey(Number(parts[0]), Number(parts[1])), item.map)
      }
    }

    function encodeIslandPixels(pixels, onDone) {
      var cancelled = false
      var reader = null
      var canvas = document.createElement('canvas')
      if (typeof canvas.getContext !== 'function') {
        onDone('')
        return function () {}
      }
      var ctx = canvas.getContext('2d')
      if (ctx === null || typeof ctx.createImageData !== 'function' || typeof ctx.putImageData !== 'function') {
        onDone('')
        return function () {}
      }
      canvas.width = pixels.width
      canvas.height = pixels.height
      var img = ctx.createImageData(pixels.width, pixels.height)
      if (typeof img.data.set === 'function') img.data.set(pixels.data)
      else {
        for (var i = 0; i < pixels.data.length; i++) img.data[i] = pixels.data[i]
      }
      ctx.putImageData(img, 0, 0)
      function finish(value) {
        if (cancelled) return
        canvas.width = 0
        canvas.height = 0
        onDone(value || '')
      }
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(function (blob) {
          if (cancelled) return
          if (!blob) {
            finish('')
            return
          }
          if (typeof FileReader !== 'function') {
            finish('')
            return
          }
          reader = new FileReader()
          reader.onload = function () { finish(String(reader.result || '')) }
          reader.onerror = function () { finish('') }
          reader.readAsDataURL(blob)
        }, 'image/png')
        return function () {
          cancelled = true
          canvas.width = 0
          canvas.height = 0
          if (reader) {
            try { reader.onload = null; reader.onerror = null; reader.abort() } catch (_error) {}
          }
        }
      }
      finish(typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : '')
      return function () { cancelled = true }
    }

    function notifyIslandSubs(entry, value) {
      var list = entry.subs.slice()
      entry.subs.length = 0
      for (var i = 0; i < list.length; i++) {
        if (list[i].live) list[i].fn(value)
      }
    }

    function cancelPendingIslandEntry(key, entry) {
      entry.cancelled = true
      cancelIslandLensPixelJob(entry.job)
      if (entry.idle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(entry.idle)
      if (entry.tid !== null) clearTimeout(entry.tid)
      if (typeof entry.cancelEncode === 'function') entry.cancelEncode()
      islandMapPendingJobs.delete(key)
    }

    function pumpIslandEntry(entry, deadline) {
      if (entry.cancelled) return
      entry.idle = null
      entry.tid = null
      var done = stepIslandLensPixelJob(entry.job, deadline || null)
      if (!done) {
        scheduleIslandPump(entry)
        return
      }
      if (entry.job.cancelled) return
      islandLensRuntime.jobsCompleted += 1
      entry.cancelEncode = encodeIslandPixels(finishIslandLensPixelJob(entry.job), function (map) {
        if (entry.cancelled) return
        islandMapPendingJobs.delete(entry.key)
        if (!map) {
          islandLensRuntime.encodeFails += 1
          notifyIslandSubs(entry, '')
          return
        }
        rememberIslandMap(entry.key, map)
        notifyIslandSubs(entry, map)
      })
    }

    function scheduleIslandPump(entry) {
      if (entry.cancelled) return
      if (typeof requestIdleCallback === 'function') {
        entry.idle = requestIdleCallback(function (deadline) { pumpIslandEntry(entry, deadline) }, { timeout: 500 })
        return
      }
      entry.tid = setTimeout(function () {
        pumpIslandEntry(entry, null)
      }, 0)
    }

    function requestIslandLensMap(boxW, boxH, onDone) {
      var key = islandLensCacheKey(boxW, boxH)
      var cached = peekIslandLensMap(boxW, boxH)
      if (cached !== null) {
        onDone(cached)
        return function () {}
      }
      var entry = islandMapPendingJobs.get(key)
      if (!entry) {
        islandLensRuntime.jobsStarted += 1
        entry = {
          key: key,
          job: createIslandLensPixelJob(boxW, boxH),
          subs: [],
          cancelled: false,
          idle: null,
          tid: null,
          cancelEncode: null,
        }
        islandMapPendingJobs.set(key, entry)
        scheduleIslandPump(entry)
      }
      var sub = { fn: onDone, live: true }
      entry.subs.push(sub)
      return function () {
        sub.live = false
        var next = []
        for (var i = 0; i < entry.subs.length; i++) {
          if (entry.subs[i].live) next.push(entry.subs[i])
        }
        entry.subs = next
        if (entry.subs.length === 0) cancelPendingIslandEntry(key, entry)
      }
    }

    function buildIslandLensMap(boxW, boxH) {
      var cached = peekIslandLensMap(boxW, boxH)
      return cached === null ? '' : cached
    }
