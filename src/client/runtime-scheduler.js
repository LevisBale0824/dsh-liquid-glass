    // Layer: coalesce rAF work and replaceable retry batches.
    function createFrameGate(callback) {
      var frame = null
      var live = true
      function schedule() {
        if (!live) return
        if (frame !== null) return
        if (typeof requestAnimationFrame !== 'function') {
          callback()
          return
        }
        frame = requestAnimationFrame(function () {
          frame = null
          if (!live) return
          callback()
        })
      }
      function cancel() {
        if (frame !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frame)
        }
        frame = null
      }
      function dispose() {
        live = false
        cancel()
      }
      function pending() {
        return frame !== null
      }
      return { schedule: schedule, cancel: cancel, dispose: dispose, pending: pending }
    }

    function createRetryBatch(callback, limit) {
      var timers = []
      var live = true
      var maxPending = limit > 0 ? limit : 8
      function start(delays) {
        if (!live) return
        cancel()
        var list = delays || []
        var count = list.length < maxPending ? list.length : maxPending
        for (var i = 0; i < count; i++) {
          ;(function (ms) {
            var id = setTimeout(function () {
              var idx = timers.indexOf(id)
              if (idx >= 0) timers.splice(idx, 1)
              if (!live) return
              callback()
            }, ms)
            timers.push(id)
          })(list[i])
        }
      }
      function cancel() {
        for (var i = 0; i < timers.length; i++) clearTimeout(timers[i])
        timers.length = 0
      }
      function dispose() {
        live = false
        cancel()
      }
      function pending() {
        return timers.length
      }
      return { start: start, cancel: cancel, dispose: dispose, pending: pending }
    }
