    // Layer: measure sidebar/title/pane island boxes.
    function readBeforeRadius(el, fallback) {
      if (typeof getComputedStyle !== 'function' || el === null) return fallback
      var cs = getComputedStyle(el, '::before')
      if (cs === null || cs === undefined) return fallback
      var n = parseFloat(cs.borderTopLeftRadius || '')
      return Number.isFinite(n) && n > 0 ? n : fallback
    }

    function measureIslandShapes() {
      if (typeof document === 'undefined') return null
      var sideHost = document.querySelector("[data-slot='sidebar'] > :first-child")
      var titleHost = document.querySelector("[data-slot='conversation.session.header'] > header")
      var paneHost = document.querySelector("[data-slot='conversation'] > [data-phase='active']")
        || document.querySelector("[data-slot='conversation'] > [data-phase]")
      if (sideHost === null || titleHost === null || paneHost === null) return null
      var gutter = 8
      var split = 4
      var titleTop = 6
      var titleFoot = 8
      var collapsed = (document.body && document.body.getAttribute('data-dsh-sidebar-collapsed') !== null)
        || document.querySelector('[data-sidebar-collapsed]') !== null
      var sidePadLeft = collapsed ? 3 : gutter
      var sidePadRight = collapsed ? 3 : split
      var sidePadBot = collapsed ? 4 : gutter
      var headerH = titleHost.offsetHeight || 0
      var heroPane = paneHost.getAttribute('data-phase') === 'hero' || headerH === 0
      var paneCut = heroPane ? titleTop : headerH + 3
      return {
        sidebar: {
          w: Math.max(16, (sideHost.clientWidth || 260) - sidePadLeft - sidePadRight),
          h: Math.max(16, (sideHost.clientHeight || 600) - titleTop - sidePadBot),
          r: readBeforeRadius(sideHost, ISLAND_LENS.cornerRadius),
        },
        title: {
          w: Math.max(16, (titleHost.clientWidth || 800) - split - gutter),
          h: Math.max(16, (titleHost.clientHeight || 56) - titleTop - titleFoot),
          r: readBeforeRadius(titleHost, ISLAND_LENS.cornerRadius),
        },
        pane: {
          w: Math.max(16, (paneHost.clientWidth || 800) - split - gutter),
          h: Math.max(16, (paneHost.clientHeight || 600) - paneCut - 8),
          r: readBeforeRadius(paneHost, ISLAND_LENS.cornerRadius),
        },
      }
    }
