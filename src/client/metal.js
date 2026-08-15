    // Layer: send/stop/+ metal rings over official composer buttons.
    function metalRingsEqual(a, b) {
      if (a.length !== b.length) return false
      for (var i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id) return false
        if (Math.round(a[i].left) !== Math.round(b[i].left)) return false
        if (Math.round(a[i].top) !== Math.round(b[i].top)) return false
        if (Math.round(a[i].width) !== Math.round(b[i].width)) return false
        if (Math.round(a[i].height) !== Math.round(b[i].height)) return false
      }
      return true
    }

    function hasDraftText(value) {
      if (!value) return false
      return /\S/.test(String(value))
    }

    function collectMetalRings(cache) {
      var next = []
      if (typeof document === 'undefined' || document.body === null) return next
      if (!document.body.getAttribute || !document.body.getAttribute(GLASS_ATTRIBUTE)) return next
      var card = cache.card
      if (card === null || (typeof document.body.contains === 'function' && !document.body.contains(card))) {
        card = document.querySelector('[data-composer-card]')
        cache.card = card
        cache.buttons = null
      }
      if (card === null) return next
      var textarea = card.querySelector('textarea')
      var hasText = textarea ? hasDraftText(textarea.value) : false
      var buttons = card.getElementsByTagName('button')
      var changed = cache.buttons === null || buttons.length !== cache.buttons.length
      if (!changed) {
        for (var b = 0; b < buttons.length; b++) {
          if (buttons[b] !== cache.buttons[b]) {
            changed = true
            break
          }
        }
      }
      if (changed) {
        cache.plus = card.querySelector('button[aria-haspopup="listbox"]')
        cache.stop = null
        cache.send = null
        cache.buttons = []
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i]
          cache.buttons.push(btn)
          if (btn === cache.plus) continue
          var svg = btn.querySelector('svg')
          if (svg === null) continue
          if (svg.querySelector('rect') !== null) cache.stop = btn
          else if (svg.querySelector('path') !== null) cache.send = btn
        }
      }
      function push(id, el) {
        if (el === null || typeof el.getBoundingClientRect !== 'function') return
        var rect = el.getBoundingClientRect()
        if ((rect.width || 0) < 8 || (rect.height || 0) < 8) return
        next.push({
          id: id,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      if (hasText) push('send', cache.send)
      if (cache.stop !== null) {
        push('stop', cache.stop)
        push('plus', cache.plus)
      }
      return next
    }

    function ComposerMetal() {
      var pair = React.useState([])
      var rings = pair[0]
      var setRings = pair[1]
      React.useEffect(function () {
        var live = true
        var streamTimer = null
        var observer = null
        var observed = []
        var cache = { card: null, buttons: null, plus: null, send: null, stop: null }
        var STREAM_MS = 100

        function syncObserved(next) {
          if (observer === null) return
          var same = next.length === observed.length
          if (same) {
            for (var i = 0; i < next.length; i++) {
              if (next[i] !== observed[i]) {
                same = false
                break
              }
            }
          }
          if (same) return
          observer.disconnect()
          observed = next
          for (var j = 0; j < observed.length; j++) {
            if (observed[j] !== null) observer.observe(observed[j])
          }
        }

        function paint() {
          if (!live) return
          var next = collectMetalRings(cache)
          setRings(function (prev) { return metalRingsEqual(prev, next) ? prev : next })
          var targets = []
          if (cache.card !== null) targets.push(cache.card)
          if (cache.send !== null) targets.push(cache.send)
          if (cache.stop !== null) targets.push(cache.stop)
          if (cache.plus !== null) targets.push(cache.plus)
          syncObserved(targets)
          var hasStop = false
          for (var i = 0; i < next.length; i++) {
            if (next[i].id === 'stop') {
              hasStop = true
              break
            }
          }
          if (hasStop) armStreamWatch()
          else clearStreamWatch()
        }

        var frameGate = createFrameGate(paint)

        function schedule() {
          frameGate.schedule()
        }

        function clearStreamWatch() {
          if (streamTimer !== null) {
            clearTimeout(streamTimer)
            streamTimer = null
          }
        }

        function armStreamWatch() {
          if (!live || streamTimer !== null) return
          streamTimer = setTimeout(function () {
            streamTimer = null
            if (!live) return
            schedule()
          }, STREAM_MS)
        }

        function glassOn() {
          return !!(document.body && document.body.getAttribute && document.body.getAttribute(GLASS_ATTRIBUTE))
        }

        function onEvent() {
          if (!glassOn()) return
          schedule()
        }

        function cardContains(card, target) {
          if (card === null || target === null || target === undefined) return false
          if (card === target) return true
          if (typeof card.contains === 'function') return card.contains(target)
          return false
        }

        function probeComposerIdentity() {
          if (!live || !glassOn()) return
          var next = document.querySelector('[data-composer-card]')
          if (next === cache.card) return
          cache.card = next
          cache.buttons = null
          cache.plus = null
          cache.send = null
          cache.stop = null
          schedule()
          clickBatch.start([0, 50, 150, 400, 1000])
        }

        function onClick(event) {
          if (!glassOn()) return
          var target = event && event.target
          var card = cache.card
          if (card !== null && typeof document.body.contains === 'function' && !document.body.contains(card)) {
            card = null
            cache.card = null
            cache.buttons = null
          }
          if (cardContains(card, target)) {
            schedule()
            clickBatch.start([0, 50, 150, 400, 1000])
            return
          }
          routeProbeBatch.start([50, 400])
        }

        var clickBatch = createRetryBatch(schedule, 5)
        var routeProbeBatch = createRetryBatch(probeComposerIdentity, 2)

        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(schedule)
        }
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('input', onEvent, true)
          document.addEventListener('click', onClick, true)
          document.addEventListener('visibilitychange', onEvent)
        }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('resize', onEvent)
          window.addEventListener('scroll', onEvent, { capture: true, passive: true })
        }
        schedule()
        return function () {
          live = false
          frameGate.dispose()
          clickBatch.dispose()
          routeProbeBatch.dispose()
          clearStreamWatch()
          if (observer !== null) observer.disconnect()
          if (typeof document.removeEventListener === 'function') {
            document.removeEventListener('input', onEvent, true)
            document.removeEventListener('click', onClick, true)
            document.removeEventListener('visibilitychange', onEvent)
          }
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('resize', onEvent)
            window.removeEventListener('scroll', onEvent, { capture: true })
          }
        }
      }, [])
      return rings.map(function (ring) {
        return React.createElement('div', {
          key: ring.id,
          'data-lg-metal-ring': ring.id,
          style: {
            position: 'fixed',
            left: ring.left - 2,
            top: ring.top - 2,
            width: ring.width + 4,
            height: ring.height + 4,
            zIndex: 20,
          },
        })
      })
    }
