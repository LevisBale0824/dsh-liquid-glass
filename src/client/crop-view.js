    // Layer: free-crop overlay for imported wallpapers. Mounts in shell.overlay
    // (body-level, above the settings dialog) and reads the controller's crop
    // session. Geometry helpers are pure so tests can load this layer directly.

    var CROP_MIN = 0.05
    var CROP_ROUND = 1000000
    var cropDragState = null

    function roundCrop(value) {
      return Math.round(value * CROP_ROUND) / CROP_ROUND
    }

    function clampCropRect(rect) {
      var w = Math.max(CROP_MIN, Math.min(1, rect.w))
      var h = Math.max(CROP_MIN, Math.min(1, rect.h))
      var x = Math.max(0, Math.min(1 - w, rect.x))
      var y = Math.max(0, Math.min(1 - h, rect.y))
      return { x: roundCrop(x), y: roundCrop(y), w: roundCrop(w), h: roundCrop(h) }
    }

    function moveCropRect(rect, dx, dy) {
      return clampCropRect({ x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h })
    }

    function resizeCropRect(rect, dir, dx, dy, aspect) {
      var e = dir.indexOf('e') !== -1
      var s = dir.indexOf('s') !== -1
      var ww = dir.indexOf('w') !== -1
      var n = dir.indexOf('n') !== -1
      var x = rect.x
      var y = rect.y
      var w = rect.w
      var h = rect.h
      if (e) w = rect.w + dx
      if (ww) { w = rect.w - dx; x = rect.x + dx }
      if (s) h = rect.h + dy
      if (n) { h = rect.h - dy; y = rect.y + dy }
      if (aspect !== null && aspect > 0) {
        var byWidth = Math.abs(dx) >= Math.abs(dy) || ((e || ww) && !(s || n))
        if (byWidth) {
          h = w / aspect
          if (n) y = rect.y + rect.h - h
          else if (s) y = rect.y
          else y = rect.y + (rect.h - h) / 2
        } else {
          w = h * aspect
          if (ww) x = rect.x + rect.w - w
          else if (e) x = rect.x
          else x = rect.x + (rect.w - w) / 2
        }
      }
      return clampCropRect({ x: x, y: y, w: w, h: h })
    }

    function fitAspectRect(rect, aspect) {
      var w = 1
      var h = 1
      if (aspect !== null && aspect > 0) {
        if (aspect >= 1) { h = w / aspect } else { w = h * aspect }
      }
      var cx = rect.x + rect.w / 2
      var cy = rect.y + rect.h / 2
      return clampCropRect({ x: cx - w / 2, y: cy - h / 2, w: w, h: h })
    }

    function rectToSource(rect, naturalW, naturalH) {
      return {
        x: Math.max(0, Math.round(rect.x * naturalW)),
        y: Math.max(0, Math.round(rect.y * naturalH)),
        w: Math.max(1, Math.round(rect.w * naturalW)),
        h: Math.max(1, Math.round(rect.h * naturalH)),
      }
    }

    function CropOverlay() {
      var el = React.createElement
      var pair = React.useState(getCropSession)
      var session = pair[0]
      var setSession = pair[1]
      var rectPair = React.useState(function () { return { x: 0, y: 0, w: 1, h: 1 } })
      var rect = rectPair[0]
      var setRect = rectPair[1]
      var aspectPair = React.useState(null)
      var aspect = aspectPair[0]
      var setAspect = aspectPair[1]

      React.useEffect(function () {
        return subscribeCropSession(function (next) {
          setSession(next)
          setRect({ x: 0, y: 0, w: 1, h: 1 })
          setAspect(null)
        })
      }, [])

      if (session === null || session.image === undefined) return null

      var image = session.image
      var naturalW = image.naturalWidth || image.width || 1
      var naturalH = image.naturalHeight || image.height || 1
      var vw = (typeof window !== 'undefined' && window.innerWidth) || 1280
      var vh = (typeof window !== 'undefined' && window.innerHeight) || 800
      var stageW = Math.max(220, Math.min(vw * 0.92, 640))
      var stageH = Math.max(160, Math.min(vh * 0.56, 420))
      var scale = Math.min(stageW / naturalW, stageH / naturalH)
      var dispW = Math.max(1, Math.round(naturalW * scale))
      var dispH = Math.max(1, Math.round(naturalH * scale))

      function endDrag() {
        if (cropDragState === null) return
        cropDragState = null
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('pointermove', onDragMove)
          window.removeEventListener('pointerup', onDragEnd)
          window.removeEventListener('pointercancel', onDragEnd)
        }
      }

      function onDragMove(event) {
        var drag = cropDragState
        if (drag === null) return
        var dx = (event.clientX - drag.startX) / dispW
        var dy = (event.clientY - drag.startY) / dispH
        if (drag.mode === 'move') setRect(moveCropRect(drag.startRect, dx, dy))
        else setRect(resizeCropRect(drag.startRect, drag.dir, dx, dy, drag.aspect))
      }

      function onDragEnd(event) {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        endDrag()
      }

      function beginDrag(event, mode, dir) {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        if (typeof event.stopPropagation === 'function') event.stopPropagation()
        cropDragState = {
          mode: mode,
          dir: dir || '',
          startX: event.clientX,
          startY: event.clientY,
          startRect: rect,
          aspect: aspect,
        }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('pointermove', onDragMove)
          window.addEventListener('pointerup', onDragEnd)
          window.addEventListener('pointercancel', onDragEnd)
        }
      }

      function chooseAspect(ratio) {
        setAspect(ratio)
        if (ratio !== null) setRect(fitAspectRect(rect, ratio))
      }

      function commit() {
        if (typeof session.commit === 'function') {
          session.commit(rectToSource(rect, naturalW, naturalH))
        }
      }

      function cancel() {
        if (typeof session.cancel === 'function') session.cancel()
      }

      var handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
      var presets = [
        { key: 'free', ratio: null, label: copy('cropFree') },
        { key: 'original', ratio: naturalW / naturalH, label: copy('cropOriginal') },
        { key: '11', ratio: 1, label: '1:1' },
        { key: '43', ratio: 4 / 3, label: '4:3' },
        { key: '169', ratio: 16 / 9, label: '16:9' },
        { key: 'screen', ratio: vw / vh, label: copy('cropScreen') },
      ]

      var rectStyle = {
        left: Math.round(rect.x * dispW) + 'px',
        top: Math.round(rect.y * dispH) + 'px',
        width: Math.max(1, Math.round(rect.w * dispW)) + 'px',
        height: Math.max(1, Math.round(rect.h * dispH)) + 'px',
      }

      return el('div', { 'data-liquid-glass-crop': '', role: 'dialog', 'aria-modal': 'true', 'aria-label': copy('cropTitle') },
        el('div', { 'data-liquid-glass-crop-backdrop': '', onClick: cancel }),
        el('div', { 'data-liquid-glass-crop-panel': '' },
          el('div', { 'data-liquid-glass-crop-head': '' },
            el('span', null, copy('cropTitle')),
            el('span', { 'data-liquid-glass-crop-name': '' }, session.name || ''),
          ),
          el('div', {
            'data-liquid-glass-crop-stage': '',
            style: { width: dispW + 'px', height: dispH + 'px' },
          },
            el('img', { src: session.url, alt: '', width: dispW, height: dispH }),
            el('div', {
              'data-liquid-glass-crop-rect': '',
              style: rectStyle,
              onPointerDown: function (event) { beginDrag(event, 'move', '') },
            },
              handles.map(function (dir) {
                return el('div', {
                  key: dir,
                  'data-liquid-glass-crop-handle': dir,
                  onPointerDown: function (event) { beginDrag(event, 'resize', dir) },
                })
              }),
            ),
          ),
          el('div', { 'data-liquid-glass-crop-tools': '' },
            presets.map(function (preset) {
              return el('button', {
                key: preset.key,
                type: 'button',
                'data-liquid-glass-crop-aspect': preset.key,
                'aria-pressed': aspect === preset.ratio,
                onClick: function () { chooseAspect(preset.ratio) },
              }, preset.label)
            }),
          ),
          el('div', { 'data-liquid-glass-crop-actions': '' },
            el('button', { type: 'button', 'data-liquid-glass-crop-cancel': '', onClick: cancel }, copy('cropCancel')),
            el('button', { type: 'button', 'data-liquid-glass-crop-confirm': '', onClick: commit }, copy('cropConfirm')),
          ),
        ),
      )
    }
