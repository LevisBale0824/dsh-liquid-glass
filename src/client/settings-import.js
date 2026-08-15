    // Layer: encode an imported wallpaper to a capped data URL.
    function encodeImageFile(file, signal) {
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
        var canvas = null

        function cleanup() {
          if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
            document.removeEventListener('visibilitychange', onHide)
          }
          if (idleId !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
          idleId = null
          if (!objectUrlRevoked) {
            URL.revokeObjectURL(objectUrl)
            objectUrlRevoked = true
          }
          image.onload = null
          image.onerror = null
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

        image.onload = function () {
          function encode() {
            if (settled) return
            try {
              var width = image.naturalWidth || image.width
              var height = image.naturalHeight || image.height
              var attempts = [[1600, 0.75], [1000, 0.60], [800, 0.50]]
              for (var i = 0; i < attempts.length; i += 1) {
                var maxSide = attempts[i][0]
                var quality = attempts[i][1]
                var scale = Math.min(1, maxSide / Math.max(width, height))
                canvas = document.createElement('canvas')
                canvas.width = Math.max(1, Math.round(width * scale))
                canvas.height = Math.max(1, Math.round(height * scale))
                var context = canvas.getContext('2d')
                if (context === null) throw new Error(isZh() ? '当前环境不支持图片处理' : 'This browser cannot process the image')
                context.fillStyle = '#071225'
                context.fillRect(0, 0, canvas.width, canvas.height)
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                var data = canvas.toDataURL('image/jpeg', quality)
                canvas.width = 0
                canvas.height = 0
                canvas = null
                if (data.length <= MAX_IMAGE_DATA_URL_LENGTH) {
                  finishResolve(data)
                  return
                }
              }
              throw new Error(isZh() ? '图片压缩后仍超过 2 MB，请换一张图片' : 'Image is still over 2 MB after compression')
            } catch (error) {
              finishReject(error)
            }
          }
          if (typeof requestIdleCallback === 'function') idleId = requestIdleCallback(encode)
          else encode()
        }
        image.onerror = function () {
          finishReject(new Error(isZh() ? '图片读取失败' : 'Could not read the image'))
        }
        image.src = objectUrl
      })
    }
