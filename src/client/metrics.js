    // Layer: measure header / scrollport / composer; write clip CSS vars.
    var metricsVarOwners = typeof WeakMap === 'function' ? new WeakMap() : null

    function claimStyleOwner(node, prop, owner) {
      if (node === null || metricsVarOwners === null) return
      var byProp = metricsVarOwners.get(node)
      if (!byProp) {
        byProp = {}
        metricsVarOwners.set(node, byProp)
      }
      var owners = byProp[prop]
      if (!owners) {
        owners = new Set()
        byProp[prop] = owners
      }
      owners.add(owner)
    }

    function releaseStyleOwner(node, prop, owner) {
      if (node === null) return
      if (metricsVarOwners !== null) {
        var byProp = metricsVarOwners.get(node)
        if (byProp && byProp[prop]) {
          byProp[prop].delete(owner)
          if (byProp[prop].size > 0) return
        }
      }
      if (node.style && typeof node.style.removeProperty === 'function') node.style.removeProperty(prop)
    }

    function MetricsBridge() {
      React.useEffect(function () {
        var snap = { root: null, header: null, scroll: null, seat: null, column: null }
        var observer = null
        var observedTargets = []
        var reconnectSlow = null
        var lastClipTop = null
        var lastClipBottom = null
        var lastHeaderHeight = null
        var needsLayout = false
        var needsCrop = false
        var live = true
        var owner = {}

        function phaseOf(root) {
          return root && typeof root.getAttribute === 'function' ? root.getAttribute('data-phase') : null
        }

        function isReady(next) {
          if (next.root === null) return false
          if (phaseOf(next.root) === 'hero') return true
          return next.header !== null && next.scroll !== null && next.seat !== null && next.column !== null
        }

        function needsShell(next) {
          if (next.root === null) return true
          if (phaseOf(next.root) === 'hero') return false
          return next.header === null || next.scroll === null || next.seat === null || next.column === null
        }

        function sameTargets(a, b) {
          if (a.length !== b.length) return false
          for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false
          }
          return true
        }

        function syncObserver(targets) {
          if (observer === null) return
          var next = []
          for (var i = 0; i < targets.length; i++) {
            if (targets[i] !== null) next.push(targets[i])
          }
          if (sameTargets(observedTargets, next)) return
          if (typeof observer.unobserve === 'function') {
            for (var u = 0; u < observedTargets.length; u++) {
              if (next.indexOf(observedTargets[u]) === -1) observer.unobserve(observedTargets[u])
            }
            for (var o = 0; o < next.length; o++) {
              if (observedTargets.indexOf(next[o]) === -1) observer.observe(next[o])
            }
          } else {
            observer.disconnect()
            for (var b = 0; b < next.length; b++) observer.observe(next[b])
          }
          observedTargets = next
        }

        function resolveNodes() {
          var next = {
            root: document.querySelector("[data-slot='conversation'] > [data-phase]"),
            header: document.querySelector("[data-slot='conversation.session.header'] > header"),
            scroll: document.querySelector('[data-conversation-scroll]'),
            seat: document.querySelector('[data-composer-seat]'),
            column: document.querySelector('[data-chat-flow]'),
          }
          var changed = {
            rootChanged: next.root !== snap.root,
            headerChanged: next.header !== snap.header,
            scrollChanged: next.scroll !== snap.scroll,
            seatChanged: next.seat !== snap.seat,
            columnChanged: next.column !== snap.column,
          }
          changed.changed = changed.rootChanged || changed.headerChanged || changed.scrollChanged || changed.seatChanged || changed.columnChanged
          changed.ready = isReady(next)
          if (changed.scrollChanged) {
            if (snap.scroll !== null) snap.scroll.removeEventListener('scroll', scheduleTranscriptCrop)
            if (next.scroll !== null) next.scroll.addEventListener('scroll', scheduleTranscriptCrop, { passive: true })
          }
          if (changed.rootChanged) {
            releaseStyleOwner(snap.root, '--lg-header-height', owner)
            lastHeaderHeight = null
          }
          if (changed.columnChanged) {
            releaseStyleOwner(snap.column, '--lg-chat-clip-top', owner)
            releaseStyleOwner(snap.column, '--lg-chat-clip-bottom', owner)
            lastClipTop = null
            lastClipBottom = null
          }
          snap = next
          return changed
        }

        function cropTranscript() {
          if (snap.scroll === null || snap.seat === null || snap.column === null) return
          if (typeof snap.scroll.getBoundingClientRect !== 'function'
            || typeof snap.seat.getBoundingClientRect !== 'function'
            || typeof snap.column.getBoundingClientRect !== 'function') return
          var scrollRect = snap.scroll.getBoundingClientRect()
          var seatRect = snap.seat.getBoundingClientRect()
          var columnRect = snap.column.getBoundingClientRect()
          if ((scrollRect.width || 0) === 0 && (scrollRect.height || 0) === 0) return
          var height = Math.max(0, columnRect.height || (columnRect.bottom - columnRect.top))
          var top = Math.min(height, Math.max(0, Math.ceil(scrollRect.top - columnRect.top)))
          var visibleBottom = Math.min(scrollRect.bottom, seatRect.top)
          var bottom = Math.min(Math.max(0, height - top), Math.max(0, Math.ceil(columnRect.bottom - visibleBottom)))
          if (lastClipTop !== top) {
            snap.column.style.setProperty('--lg-chat-clip-top', top + 'px')
            claimStyleOwner(snap.column, '--lg-chat-clip-top', owner)
            lastClipTop = top
          }
          if (lastClipBottom !== bottom) {
            snap.column.style.setProperty('--lg-chat-clip-bottom', bottom + 'px')
            claimStyleOwner(snap.column, '--lg-chat-clip-bottom', owner)
            lastClipBottom = bottom
          }
        }

        function applyLayout() {
          var info = resolveNodes()
          if (info.changed && observer !== null) {
            syncObserver([snap.header, snap.scroll, snap.seat, snap.column])
          }
          if (snap.root === null) return
          if (snap.header !== null && snap.header.offsetHeight > 0) {
            var nextHeight = snap.header.offsetHeight
            if (lastHeaderHeight !== nextHeight) {
              snap.root.style.setProperty('--lg-header-height', nextHeight + 'px')
              claimStyleOwner(snap.root, '--lg-header-height', owner)
              lastHeaderHeight = nextHeight
            }
          }
          if (glassOwners.size > 0) islandLensSyncs.forEach(function (fn) { fn() })
          cropTranscript()
        }

        var frameGate = createFrameGate(function () {
          if (needsLayout) {
            needsLayout = false
            needsCrop = false
            applyLayout()
            return
          }
          if (needsCrop) {
            needsCrop = false
            cropTranscript()
          }
        })

        function scheduleLayoutMeasure() {
          needsLayout = true
          frameGate.schedule()
        }

        function scheduleTranscriptCrop() {
          needsCrop = true
          frameGate.schedule()
        }

        function ensureObserver() {
          if (observer === null && typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(scheduleLayoutMeasure)
          }
          syncObserver([snap.header, snap.scroll, snap.seat, snap.column])
        }

        function stopReconnect() {
          recoverBatch.cancel()
          probeBatch.cancel()
          if (reconnectSlow !== null) {
            clearTimeout(reconnectSlow)
            reconnectSlow = null
          }
        }

        function armSlowReconnect() {
          if (!live || reconnectSlow !== null || !needsShell(snap)) return
          reconnectSlow = setTimeout(function () {
            reconnectSlow = null
            if (!live) return
            var info = resolveNodes()
            if (info.ready) {
              stopReconnect()
              ensureObserver()
              scheduleLayoutMeasure()
              return
            }
            if (needsShell(snap)) armSlowReconnect()
          }, 2000)
        }

        function onRecoverTick() {
          if (!live) return
          var info = resolveNodes()
          if (info.ready) {
            stopReconnect()
            ensureObserver()
            scheduleLayoutMeasure()
            return
          }
          if (recoverBatch.pending() === 0 && needsShell(snap)) armSlowReconnect()
        }

        var recoverBatch = createRetryBatch(onRecoverTick, 5)
        var probeBatch = createRetryBatch(function () { probeAfterClick() }, 2)

        function startRecover() {
          if (!live || isReady(snap)) return
          recoverBatch.start([150, 400, 1000])
        }

        function probeAfterClick() {
          if (!live) return
          var info = resolveNodes()
          if (info.changed || !info.ready) {
            if (info.ready) {
              stopReconnect()
              ensureObserver()
              scheduleLayoutMeasure()
            } else {
              startRecover()
            }
          }
        }

        function onImmediateCheck() {
          if (!live) return
          var info = resolveNodes()
          if (info.ready) {
            stopReconnect()
            ensureObserver()
            scheduleLayoutMeasure()
          } else if (needsShell(snap)) {
            startRecover()
          }
        }

        function afterInteraction() {
          probeAfterClick()
          probeBatch.start([0, 50])
        }

        function connect() {
          var info = resolveNodes()
          if (info.ready) {
            ensureObserver()
            scheduleLayoutMeasure()
          } else if (needsShell(snap)) {
            startRecover()
            recoverBatch.start([0, 50, 150, 400, 1000])
          }
        }

        if (typeof document.addEventListener === 'function') {
          document.addEventListener('click', afterInteraction, true)
          document.addEventListener('visibilitychange', onImmediateCheck)
        }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('resize', onImmediateCheck)
          window.addEventListener('focus', onImmediateCheck)
        }

        metricsOwners.add(owner)
        connect()
        return function () {
          live = false
          frameGate.dispose()
          recoverBatch.dispose()
          probeBatch.dispose()
          stopReconnect()
          if (observer !== null) observer.disconnect()
          if (snap.scroll !== null) snap.scroll.removeEventListener('scroll', scheduleTranscriptCrop)
          releaseStyleOwner(snap.root, '--lg-header-height', owner)
          releaseStyleOwner(snap.column, '--lg-chat-clip-top', owner)
          releaseStyleOwner(snap.column, '--lg-chat-clip-bottom', owner)
          if (typeof document.removeEventListener === 'function') {
            document.removeEventListener('click', afterInteraction, true)
            document.removeEventListener('visibilitychange', onImmediateCheck)
          }
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('resize', onImmediateCheck)
            window.removeEventListener('focus', onImmediateCheck)
          }
          metricsOwners.delete(owner)
        }
      }, [])
      return null
    }
