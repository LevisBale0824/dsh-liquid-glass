    // Layer: Dialog, menu, tooltip, HoverCard portal.
    var cssOverlays = String.raw`
/* Material only. Never position/inset/display/flex/size/overflow/z-index
   or any property that creates a fixed containing block. Tooltips share
   the glass plate; they are never ancestors of other fixed UI. */
/* Menus / listboxes only. Settings is an official dialog — do not wrap it. */
body[data-dsh-liquid-glass] [role='menu'],
body[data-dsh-liquid-glass] [role='listbox'] {
  background-color: var(--lg-overlay-bg);
  border: 1px solid var(--lg-border-strong);
  box-shadow: var(--lg-shadow-card);
  color: var(--lg-text-primary);
}

body[data-dsh-liquid-glass] [role='tooltip'] {
  background: var(--lg-overlay-bg);
  background-clip: padding-box;
  border: 1px solid var(--lg-border-strong);
  box-shadow: var(--lg-shadow-card);
  color: var(--lg-text-primary);
  -webkit-backdrop-filter: blur(var(--lg-blur-card)) saturate(150%);
  backdrop-filter: blur(var(--lg-blur-card)) saturate(150%);
}

/* Session / workspace HoverCard is portaled to body as a copyable
   role=button. Official plate and title/time colors are hardcoded dark. */
body[data-dsh-liquid-glass] > [role='button'][aria-label] {
  background: var(--lg-overlay-bg);
  background-clip: padding-box;
  border: 1px solid var(--lg-border-strong);
  box-shadow: var(--lg-shadow-card);
  color: var(--lg-text-primary);
  -webkit-backdrop-filter: blur(var(--lg-blur-card)) saturate(150%);
  backdrop-filter: blur(var(--lg-blur-card)) saturate(150%);
}

body[data-dsh-liquid-glass] > [role='button'][aria-label] > div > div:first-child,
body[data-dsh-liquid-glass] > [role='button'][aria-label] > span {
  color: var(--lg-text-primary);
}

body[data-dsh-liquid-glass] > [role='button'][aria-label] > div > div:not(:first-child) {
  color: var(--lg-text-secondary);
}
`
