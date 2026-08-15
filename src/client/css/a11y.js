    // Layer: Composer hover, metal ring, focus, reduced-motion, forced-colors.
    var cssA11y = String.raw`
body[data-dsh-liquid-glass] [data-composer-card] button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lg-text-primary) 12%, transparent);
}

/* Official send/stop is a 34px info-fill chip with a white glyph. A light
   wash on ice would sit under the same white arrow. */
body[data-dsh-liquid-glass] [data-composer-card] button:has(> svg[width='16']):hover:not(:disabled) {
  background: var(--dsw-alias-button-info-hover);
  color: #fff;
}

@keyframes dsh-lg-metal-spin {
  to { transform: rotate(1turn); }
}

[data-lg-metal-ring] {
  pointer-events: none;
  border-radius: 50%;
  background: var(--lg-metal-ring);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 100%);
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 100%);
  box-shadow: 0 0 6px rgba(20, 28, 40, 0.45);
  animation: dsh-lg-metal-spin 2.8s linear infinite;
}

body[data-dsh-liquid-glass] [role='treeitem'][aria-selected='true']:focus-visible,
body[data-dsh-liquid-glass] [data-composer-card] button:focus-visible,
body[data-dsh-liquid-glass] [role='dialog'] button:focus-visible,
body[data-dsh-liquid-glass] [role='menu'] [role='menuitem']:focus-visible {
  outline: 2px solid #0071e3;
  outline-offset: 2px;
}

body[data-dsh-liquid-glass] [data-composer-card] button:disabled,
body[data-dsh-liquid-glass] [role='dialog'] button:disabled {
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  [data-lg-metal-ring] {
    animation: none;
  }
}

@media (forced-colors: active) {
  [data-dsh-liquid-glass-wallpaper] { display: none; }
  body[data-dsh-liquid-glass] [data-slot='sidebar'] > :first-child::before,
  body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='active']::before,
  body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='hero']::before,
  body[data-dsh-liquid-glass] [data-slot='conversation.session.header'] > header::before,
  body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='active']::after,
  body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='hero']::after,
  body[data-dsh-liquid-glass] [data-composer-card]::before,
  body[data-dsh-liquid-glass] [role='menu'],
  body[data-dsh-liquid-glass] [role='listbox'] {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    -webkit-filter: none;
    filter: none;
    forced-color-adjust: auto;
    border: 1px solid CanvasText;
  }
  body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='active']::after {
    background: transparent;
  }
}
`
