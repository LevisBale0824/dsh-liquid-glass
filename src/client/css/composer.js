    // Layer: Input card, seat, composer dock gap.
    var cssComposer = String.raw`
/* InputBar.root: 6px pad-bottom matches settings-to-sidebar-island.
   Same flex gap between the card and the stats dock. */
body[data-dsh-liquid-glass] [data-composer-seat] :has(> [data-composer-card]) {
  gap: var(--lg-dock-gap);
  padding-bottom: var(--lg-dock-gap);
}

body[data-dsh-liquid-glass] [data-composer-card] {
  position: relative;
  isolation: isolate;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  border-radius: var(--lg-radius-card);
}

body[data-dsh-liquid-glass] [data-composer-card]::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--lg-control-bg);
  background-clip: padding-box;
  -webkit-backdrop-filter: blur(var(--lg-blur-card)) saturate(155%) brightness(1.03);
  backdrop-filter: blur(var(--lg-blur-card)) saturate(155%) brightness(1.03);
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--lg-border-strong);
}
`
