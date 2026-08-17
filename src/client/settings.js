    // Layer: Settings → General Liquid Glass row.
    function SettingsRow(props) {
      var theme = props.theme
      var controller = props.controller
      var statePair = React.useState(function () {
        return { glass: readGlassEnabled(), background: readBackgroundState(theme), glassBlur: readGlassBlur(), refract: readLensRefract(), status: '' }
      })
      var state = statePair[0]
      var setState = statePair[1]
      var el = React.createElement

      var importBag = React.useState(function () {
        return { live: true, lastStamp: '', chain: Promise.resolve(), controllers: [], cropSession: null }
      })[0]

      React.useEffect(function () {
        importBag.live = true
        var unsubscribe = controller.subscribeSettings(function () {
          if (!importBag.live) return
          setState(function (current) {
            return { glass: readGlassEnabled(), background: readBackgroundState(theme), glassBlur: readGlassBlur(), refract: readLensRefract(), status: current.status }
          })
        })
        return function () {
          importBag.live = false
          for (var i = 0; i < importBag.controllers.length; i++) {
            try { importBag.controllers[i].abort() } catch (_error) {}
          }
          importBag.controllers = []
          if (importBag.cropSession !== null) {
            try { importBag.cropSession.cancel() } catch (_error) {}
            importBag.cropSession = null
          }
          unsubscribe()
        }
      }, [])

      var failStatus = function (ok) {
        return ok ? '' : copy('persistFail')
      }

      var refresh = function (patch, status) {
        controller.applyAtmosphere(theme)
        setState({
          glass: patch.glass === undefined ? readGlassEnabled() : patch.glass,
          background: patch.background || readBackgroundState(theme),
          glassBlur: patch.glassBlur === undefined ? readGlassBlur() : patch.glassBlur,
          refract: patch.refract === undefined ? readLensRefract() : patch.refract,
          status: status,
        })
        controller.notifySettings()
      }

      var toggleGlass = function () {
        var next = !readGlassEnabled()
        var persisted = writeGlassEnabled(next)
        refresh({ glass: next }, failStatus(persisted))
      }

      var toggleRefract = function () {
        var next = !readLensRefract()
        var persisted = writeLensRefract(next)
        refresh({ refract: next }, failStatus(persisted))
      }

      var chooseBackground = function (id) {
        var data = state.background.custom
        var hit = customFromLibrary(state.background.customs || [], id)
        if (hit !== null) data = hit.data
        var next = {
          id: id,
          custom: data,
          customs: state.background.customs || [],
          opacity: state.background.opacity,
        }
        var persisted = saveBackgroundState(next.id, next.custom, next.opacity)
        refresh({ background: next }, failStatus(persisted))
      }

      var updateOpacity = function (opacity) {
        var next = {
          id: state.background.id,
          custom: state.background.custom,
          customs: state.background.customs || [],
          opacity: clamp(opacity, 0.35, 1, state.background.opacity),
        }
        var persisted = saveBackgroundState(next.id, next.custom, next.opacity)
        refresh({ background: next }, failStatus(persisted))
      }

      var updateGlassBlur = function (value) {
        var next = clamp(value, 0, 40, state.glassBlur)
        var persisted = writeGlassBlur(next)
        refresh({ glassBlur: next }, failStatus(persisted))
      }

      var onFile = function (event) {
        var input = event.currentTarget || event.target
        var file = input && input.files && input.files[0]
        if (file === undefined) return
        var stamp = String(file.name || '') + '\0' + String(file.size || 0) + '\0' + String(file.lastModified || 0)
        if (stamp === importBag.lastStamp) {
          input.value = ''
          return
        }
        importBag.lastStamp = stamp
        var abort = typeof AbortController === 'function' ? new AbortController() : null
        if (abort) importBag.controllers.push(abort)
        setState({ glass: state.glass, background: state.background, glassBlur: state.glassBlur, refract: state.refract, status: copy('processing') })
        loadImageFile(file, abort ? abort.signal : undefined).then(function (handle) {
          if (!importBag.live) {
            handle.revoke()
            return
          }
          var session = {
            image: handle.image,
            url: handle.url,
            name: handle.name,
            type: handle.type,
            commit: function (region) {
              setState({ glass: readGlassEnabled(), background: readBackgroundState(theme), glassBlur: readGlassBlur(), refract: readLensRefract(), status: copy('processing') })
              encodeImageRegion(handle.image, region, handle.type, abort ? abort.signal : undefined).then(function (data) {
                importBag.chain = importBag.chain.then(function () {
                  if (!importBag.live) return
                  var background = readBackgroundState(theme)
                  var library = (background.customs || []).slice()
                  if (library.length >= MAX_CUSTOM_BACKGROUNDS) {
                    setState({
                      glass: readGlassEnabled(),
                      background: background,
                      glassBlur: readGlassBlur(),
                      refract: readLensRefract(),
                      status: copy('customFull'),
                    })
                    return
                  }
                  if (!canPersistLibrary(library, data)) {
                    setState({
                      glass: readGlassEnabled(),
                      background: background,
                      glassBlur: readGlassBlur(),
                      refract: readLensRefract(),
                      status: copy('libraryBudget'),
                    })
                    return
                  }
                  var item = { id: newCustomBackgroundId(), data: data }
                  library.push(item)
                  var next = {
                    id: item.id,
                    custom: data,
                    customs: library,
                    opacity: background.opacity,
                  }
                  var persisted = saveBackgroundState(next.id, next.custom, next.opacity, library)
                  refresh({ background: next }, failStatus(persisted))
                })
                return importBag.chain
              }).catch(function (error) {
                importBag.lastStamp = ''
                if (!importBag.live) return
                if (error && error.name === 'AbortError') return
                setState({
                  glass: readGlassEnabled(),
                  background: readBackgroundState(theme),
                  glassBlur: readGlassBlur(),
                  refract: readLensRefract(),
                  status: String(error && error.message ? error.message : error),
                })
              }).then(function () {
                controller.closeCropSession()
                handle.revoke()
                importBag.cropSession = null
                if (abort) {
                  importBag.controllers = importBag.controllers.filter(function (item) { return item !== abort })
                }
                input.value = ''
              })
            },
            cancel: function () {
              controller.closeCropSession()
              handle.revoke()
              importBag.cropSession = null
              importBag.lastStamp = ''
              if (abort) {
                importBag.controllers = importBag.controllers.filter(function (item) { return item !== abort })
              }
              if (importBag.live) {
                setState({ glass: readGlassEnabled(), background: readBackgroundState(theme), glassBlur: readGlassBlur(), refract: readLensRefract(), status: '' })
              }
              input.value = ''
            },
          }
          importBag.cropSession = session
          controller.openCropSession(session)
        }).catch(function (error) {
          importBag.lastStamp = ''
          if (!importBag.live) return
          if (error && error.name === 'AbortError') return
          setState({
            glass: readGlassEnabled(),
            background: readBackgroundState(theme),
            glassBlur: readGlassBlur(),
            refract: readLensRefract(),
            status: String(error && error.message ? error.message : error),
          })
          input.value = ''
        })
      }

      var removeCustom = function () {
        if (!isCustomBackgroundId(state.background.id)) return
        var library = (state.background.customs || []).filter(function (item) {
          return item.id !== state.background.id
        })
        var fallback = library.length > 0 ? library[library.length - 1] : null
        var next = {
          id: fallback !== null ? fallback.id : defaultBackgroundId(theme),
          custom: fallback !== null ? fallback.data : null,
          customs: library,
          opacity: state.background.opacity,
        }
        var persisted = saveBackgroundState(next.id, next.custom, next.opacity, library)
        refresh({ background: next }, failStatus(persisted))
      }

      return renderSettingsRow(el, state, {
        toggleGlass: toggleGlass,
        toggleRefract: toggleRefract,
        chooseBackground: chooseBackground,
        updateOpacity: updateOpacity,
        updateGlassBlur: updateGlassBlur,
        onFile: onFile,
        removeCustom: removeCustom,
      })
    }
