    // Layer: Settings row markup.
    function renderSettingsRow(el, state, actions) {
      var toggleGlass = actions.toggleGlass
      var toggleRefract = actions.toggleRefract
      var chooseBackground = actions.chooseBackground
      var updateOpacity = actions.updateOpacity
      var updateGlassBlur = actions.updateGlassBlur
      var onFile = actions.onFile
      var removeCustom = actions.removeCustom
      var card = function (extra) {
        return Object.assign({
          minHeight: 52,
          padding: 8,
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 12,
          background: 'var(--dsw-alias-bg-layer-1)',
          color: 'var(--dsw-alias-label-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }, extra)
      }

      var selected = function (on) {
        return on
          ? {
            border: '1px solid transparent',
            boxShadow: '0 0 0 2px #fff, 0 0 0 4px #111',
          }
          : {
            border: '1px solid rgba(128, 128, 128, 0.35)',
            boxShadow: 'none',
          }
      }

      var backgrounds = BACKGROUNDS.filter(function (item) { return item.id !== 'none' })
      ;(state.background.customs || []).forEach(function (item) {
        backgrounds = backgrounds.concat([{ id: item.id, css: cssUrl(item.data) }])
      })

      return el('div', { 'data-liquid-glass-settings': '' },
        el('div', { 'data-liquid-glass-head': '' },
          el('div', { 'data-liquid-glass-heading': '' }, copy('glass')),
          el('button', {
            type: 'button',
            'data-liquid-glass-toggle': '',
            'aria-pressed': state.glass,
            onClick: toggleGlass,
            style: {
              minWidth: 64, height: 32, borderRadius: 999, flex: '0 0 auto',
              border: '1px solid var(--dsw-alias-border-l2)',
              background: state.glass ? 'var(--lg-toggle-on-fill)' : 'var(--dsw-alias-bg-layer-2)',
              color: state.glass ? 'var(--lg-toggle-on-ink)' : 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 14,
              lineHeight: '22px',
            },
          }, state.glass ? copy('glassOn') : copy('glassOff')),
        ),
        el('div', { 'data-liquid-glass-background-grid': '' },
          backgrounds.map(function (item) {
            return el('button', {
              key: item.id,
              type: 'button',
              'data-liquid-glass-background-choice': item.id,
              'aria-label': isCustomBackgroundId(item.id) ? copy('custom') : (copy(item.id) || item.id),
              'aria-pressed': state.background.id === item.id,
              style: Object.assign(card(selected(state.background.id === item.id)), {
                minHeight: 64,
                backgroundImage: item.css,
                backgroundSize: 'cover',
              }),
              onClick: function () { chooseBackground(item.id) },
            })
          }),
        ),
        el('div', { 'data-liquid-glass-import-row': '' },
          el('label', {
            'data-liquid-glass-import': '',
            style: card({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 32, width: 'fit-content', maxWidth: '100%' }),
          },
            el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onChange: onFile, style: { display: 'none' } }),
            copy('import'),
          ),
          isCustomBackgroundId(state.background.id)
            ? el('button', {
              type: 'button',
              'data-liquid-glass-remove': '',
              onClick: removeCustom,
              style: card({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 32,
                width: 'fit-content',
                maxWidth: '100%',
              }),
            }, copy('remove'))
            : null,
        ),
        el('label', { 'data-liquid-glass-slider-row': '' },
          el('span', null, copy('opacity')),
          el('input', {
            type: 'range', min: 35, max: 100, step: 1,
            value: Math.round(state.background.opacity * 100),
            onChange: function (event) { updateOpacity(Number(event.target.value) / 100) },
          }),
          el('span', null, Math.round(state.background.opacity * 100) + '%'),
        ),
        el('label', { 'data-liquid-glass-slider-row': '' },
          el('span', null, copy('blur')),
          el('input', {
            type: 'range', min: 0, max: 40, step: 1,
            'data-liquid-glass-blur': '',
            value: state.glassBlur,
            onChange: function (event) { updateGlassBlur(Number(event.target.value)) },
          }),
          el('span', null, state.glassBlur + 'px'),
        ),
        el('div', { 'data-liquid-glass-head': '' },
          el('div', { 'data-liquid-glass-heading': '' }, copy('refract')),
          el('button', {
            type: 'button',
            'data-liquid-glass-refract': '',
            'aria-pressed': state.refract,
            onClick: toggleRefract,
            style: {
              minWidth: 64, height: 32, borderRadius: 999, flex: '0 0 auto',
              border: '1px solid var(--dsw-alias-border-l2)',
              background: state.refract ? 'var(--lg-toggle-on-fill)' : 'var(--dsw-alias-bg-layer-2)',
              color: state.refract ? 'var(--lg-toggle-on-ink)' : 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 14,
              lineHeight: '22px',
            },
          }, state.refract ? copy('glassOn') : copy('glassOff')),
        ),
        state.status === '' ? null : el('div', { role: 'status', style: { fontSize: 12 } }, state.status),
      )
    }
