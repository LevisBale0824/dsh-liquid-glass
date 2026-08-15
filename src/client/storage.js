    // Layer: localStorage helpers and apply rollback.
    function storageGet(key) {
      try { return window.localStorage.getItem(key) }
      catch (_error) { return null }
    }

    function storageSet(key, value) {
      try {
        if (value === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, value)
        return true
      } catch (_error) {
        return false
      }
    }

    function clamp(value, min, max, fallback) {
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
    }

    function readNumber(key, min, max, fallback) {
      var raw = storageGet(key)
      if (raw === null) return fallback
      return clamp(Number(raw), min, max, fallback)
    }

    function runWithRollback(steps) {
      var disposers = []
      try {
        for (var i = 0; i < steps.length; i += 1) {
          var dispose = steps[i]()
          if (typeof dispose === 'function') disposers.push(dispose)
        }
        return function () {
          for (var j = disposers.length - 1; j >= 0; j -= 1) {
            try { disposers[j]() } catch (_error) {}
          }
        }
      } catch (error) {
        for (var k = disposers.length - 1; k >= 0; k -= 1) {
          try { disposers[k]() } catch (_error) {}
        }
        throw error
      }
    }
