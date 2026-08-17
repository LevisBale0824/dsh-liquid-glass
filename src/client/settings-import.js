    // Layer: load an image file, keep original quality, and encode a (possibly
    // cropped) region to a budget-capped data URL. PNG sources keep lossless
    // alpha; JPEG re-encode only kicks in when the budget forces it.
    function loadImageFile(file, signal) {
      return new Promise(function (resolve, reject) {
        var type = file === undefined ? '' : String(file.type || '')
        var fileName = file === undefined ? '' : String(file.name || '').toLowerCase()
        var extensionOk = /\.(png|jpe?g|webp)$/.test(fileName)
        if (file === undefined || (type.indexOf('image/') !== 0 && !extensionOk)) {
          reject(new Error(isZh() ? '请选择图片文件' : 'Choose an image file'))
          return
        }
        if (file.size > 12 * 1024 * 1024) {
          reject(new Error(isZh() ? '图片不能超过 12 MB' : 'Image must be 12 MB or smaller'))
          return
        }
        var settled = false
        var objectUrlRevoked = false
        var objectUrl = URL.createObjectURL(file)
        var idleId = null
        var image = new Image()

        function cleanup(revoke) {
          if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', onHide)
          }
          if (idleId !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
          idleId = null
          image.onload = null
          image.onerror = null
          if (revoke && !objectUrlRevoked) {
            URL.revokeObjectURL(objectUrl)
            objectUrlRevoked = true
          }
          if (signal && typeof signal.removeEventListener === 'function') {
            signal.removeEventListener('abort', onAbort)
          }
        }

        function finishResolve(handle) {
          if (settled) return
          settled = true
          cleanup(false)
          resolve(handle)
        }

        function finishReject(error) {
          if (settled) return
          settled = true
          cleanup(true)
          reject(error)
        }

        function onHide() {
          if (document.visibilityState === 'hidden') {
            finishReject(new Error(isZh() ? '图片读取失败' : 'Could not read the image'))
          }
        }

        function onAbort() {
          var err = new Error('AbortError')
          err.name = 'AbortError'
          finishReject(err)
        }

        if (signal) {
          if (signal.aborted) {
            onAbort()
            return
          }
          if (typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort)
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', onHide)
        }

        image.onload = function () {
          finishResolve({
            image: image,
            url: objectUrl,
            name: String(file.name || ''),
            type: type || (fileName.indexOf('.png') !== -1 ? 'image/png' : fileName.indexOf('.webp') !== -1 ? 'image/webp' : 'image/jpeg'),
            revoke: function () {
              if (!objectUrlRevoked) {
                URL.revokeObjectURL(objectUrl)
                objectUrlRevoked = true
              }
            },
          })
        }
        image.onerror = function () {
          finishReject(new Error(isZh() ? '图片读取失败' : 'Could not read the image'))
        }
        image.src = objectUrl
      })
    }

    // Encode a canvas region. Tries the original resolution first; only when
    // the resulting data URL exceeds the per-image budget does it downscale.
    // PNG/WebP sources stay lossless PNG (keeps alpha); JPEG fallback only
    // when the budget cannot fit a PNG.
    function encodeCanvasLadder(canvas, sourceType) {
      var type = String(sourceType || '').toLowerCase()
      var keepPng = type.indexOf('png') !== -1 || type.indexOf('webp') !== -1
      var attempts = []
      if (keepPng) {
        attempts.push(['png', Infinity, 0])
        attempts.push(['png', 2560, 0])
        attempts.push(['png', 2048, 0])
        attempts.push(['png', 1600, 0])
        attempts.push(['png', 1280, 0])
        attempts.push(['jpeg', 1600, 0.92])
        attempts.push(['jpeg', 1280, 0.88])
        attempts.push(['jpeg', 1024, 0.85])
      } else {
        attempts.push(['jpeg', Infinity, 0.92])
        attempts.push(['jpeg', 2560, 0.92])
        attempts.push(['jpeg', 2048, 0.88])
        attempts.push(['jpeg', 1600, 0.85])
        attempts.push(['jpeg', 1280, 0.80])
        attempts.push(['jpeg', 1024, 0.75])
      }
      for (var i = 0; i < attempts.length; i++) {
        var entry = attempts[i]
        var format = entry[0]
        var maxSide = entry[1]
        var quality = entry[2]
        var w = canvas.width
        var h = canvas.height
        var scale = Math.min(1, maxSide / Math.max(w, h))
        var out = canvas
        if (scale < 1) {
          out = document.createElement('canvas')
          out.width = Math.max(1, Math.round(w * scale))
          out.height = Math.max(1, Math.round(h * scale))
          var context = out.getContext('2d')
          if (context === null) continue
          if (format === 'jpeg') {
            context.fillStyle = '#071225'
            context.fillRect(0, 0, out.width, out.height)
          }
          context.drawImage(canvas, 0, 0, out.width, out.height)
        }
        var data = format === 'png' ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', quality)
        if (out !== canvas) {
          out.width = 0
          out.height = 0
        }
        if (data.length <= MAX_IMAGE_DATA_URL_LENGTH) return data
      }
      throw new Error(isZh() ? '图片压缩后仍超过 2 MB，请换一张图片' : 'Image is still over 2 MB after compression')
    }

    // Encode a region of an already-loaded image. region is in source pixels:
    // { x, y, w, h }. Omit for the full image.
    function encodeImageRegion(image, region, sourceType, signal) {
      return new Promise(function (resolve, reject) {
        var settled = false
        var canvas = null
        var idleId = null

        function cleanup() {
          if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', onHide)
          }
          if (idleId !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
          idleId = null
          if (canvas !== null) {
            canvas.width = 0
            canvas.height = 0
            canvas = null
          }
          if (signal && typeof signal.removeEventListener === 'function') {
            signal.removeEventListener('abort', onAbort)
          }
        }

        function finishResolve(value) {
          if (settled) return
          settled = true
          cleanup()
          resolve(value)
        }

        function finishReject(error) {
          if (settled) return
          settled = true
          cleanup()
          reject(error)
        }

        function onHide() {
          if (document.visibilityState === 'hidden') {
            finishReject(new Error(isZh() ? '图片读取失败' : 'Could not read the image'))
          }
        }

        function onAbort() {
          var err = new Error('AbortError')
          err.name = 'AbortError'
          finishReject(err)
        }

        if (signal) {
          if (signal.aborted) {
            onAbort()
            return
          }
          if (typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort)
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', onHide)
        }

        function encode() {
          if (settled) return
          try {
            var nw = image.naturalWidth || image.width
            var nh = image.naturalHeight || image.height
            var r = region || { x: 0, y: 0, w: nw, h: nh }
            var sx = Math.max(0, Math.round(Number(r.x) || 0))
            var sy = Math.max(0, Math.round(Number(r.y) || 0))
            var sw = Math.max(1, Math.min(nw - sx, Math.round(Number(r.w) || (nw - sx))))
            var sh = Math.max(1, Math.min(nh - sy, Math.round(Number(r.h) || (nh - sy))))
            canvas = document.createElement('canvas')
            canvas.width = sw
            canvas.height = sh
            var context = canvas.getContext('2d')
            if (context === null) throw new Error(isZh() ? '当前环境不支持图片处理' : 'This browser cannot process the image')
            context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
            var data = encodeCanvasLadder(canvas, sourceType)
            canvas.width = 0
            canvas.height = 0
            canvas = null
            finishResolve(data)
          } catch (error) {
            finishReject(error)
          }
        }

        if (typeof requestIdleCallback === 'function') idleId = requestIdleCallback(encode)
        else encode()
      })
    }

    // Full-image import (kept for tests and as the no-crop path).
    function encodeImageFile(file, signal) {
      return loadImageFile(file, signal).then(function (handle) {
        return encodeImageRegion(handle.image, null, handle.type, signal).then(function (data) {
          handle.revoke()
          return data
        }, function (error) {
          handle.revoke()
          throw error
        })
      })
    }
