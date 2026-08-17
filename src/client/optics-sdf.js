    // Layer: SDF primitives and SVG filter markup.
    function sdRoundBox(px, py, hx, hy, radius) {
      var ax = Math.abs(px) - hx + radius
      var ay = Math.abs(py) - hy + radius
      var ox = Math.max(ax, 0)
      var oy = Math.max(ay, 0)
      return Math.min(Math.max(ax, ay), 0) + Math.sqrt(ox * ox + oy * oy) - radius
    }

    function erfApprox(x) {
      return Math.tanh(Math.sqrt(Math.PI) * x)
    }

    function encodeAxis(signed) {
      return Math.max(0, Math.min(255, ((0.5 + signed) * 255 + 0.5) | 0))
    }

    function encodeSpec(spec) {
      return Math.max(0, Math.min(255, (127 * spec + 128 + 0.5) | 0))
    }

    function domeGradient(distance, radius, scale) {
      var inside = Math.min(distance, radius * (1 - 1e-3))
      return (inside / Math.sqrt(radius * radius - inside * inside)) * scale
    }

    function islandDisplacementScale() {
      return readLensRefract() ? ISLAND_LENS.strength : 0
    }

    function buildIslandFilterPrimitives(map, scale) {
      if (!map) {
        return '<feTurbulence type="fractalNoise" baseFrequency="0.01 0.014" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.08" xChannelSelector="R" yChannelSelector="G"/>'
      }
      var d = ISLAND_LENS.dispersion
      var spread = DISPERSION_SPREAD
      var parts = [
        '<feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="mapBg"/>',
        '<feImage href="' + map + '" xlink:href="' + map + '" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="rawMap"/>',
        '<feComposite in="rawMap" in2="mapBg" operator="over" result="map"/>',
      ]
      if (d > 0) {
        parts.push(
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (scale * (1 + spread * d)) + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="refractR"/>',
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (scale * (1 + spread * 0.5 * d)) + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="refractG"/>',
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>',
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="refractB"/>',
          '<feComposite in="refractR" in2="refractG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="refractRG"/>',
          '<feComposite in="refractRG" in2="refractB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensOut"/>',
        )
      } else {
        parts.push('<feDisplacementMap in="SourceGraphic" in2="map" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G" result="lensOut"/>')
      }
      if (ISLAND_LENS.sheen > 0 || ISLAND_LENS.glow > 0) {
        parts.push(
          '<feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.502" result="sheenMask"/>',
          '<feComposite in="sheenMask" in2="lensOut" operator="arithmetic" k1="0" k2="' + ISLAND_LENS.specular + '" k3="1" k4="0"/>',
        )
      }
      return parts.join('')
    }
