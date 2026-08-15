    // Layer: Drag handle, New Session, settings, workspace tools.
    var cssSidebarChrome = String.raw`
/* Official sidebar drag handle is 8px wide, shifted −4px, so it covers the
   workspace + . Park it entirely in the conversation column. */
body[data-dsh-liquid-glass] [data-side='sidebar'] {
  margin-left: 0;
  z-index: 1;
}

body[data-dsh-liquid-glass] [data-slot='sidebar'] [role='treeitem'] button {
  position: relative;
  z-index: 5;
  pointer-events: auto;
}

/* New session is the second child of SidebarRoot (Tooltip or the button). */
body[data-dsh-liquid-glass] [data-slot='sidebar'] > :first-child > :nth-child(2) {
  background: var(--lg-control-bg);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-radius-control);
  box-shadow: var(--lg-shadow-card);
}

body[data-dsh-liquid-glass] [data-slot='sidebar.settings'] > button[aria-haspopup='dialog'] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: auto !important;
  height: 38px;
  margin: 4px 2px 8px !important;
  padding: 0 14px !important;
  background: var(--lg-control-bg);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-radius-control);
  box-shadow: var(--lg-shadow-card);
}

/* In rail mode the official trigger is icon-only. Keep it centred and circular
   instead of inheriting the expanded sidebar's inset capsule geometry. */
body[data-dsh-liquid-glass] [data-sidebar-collapsed] [data-slot='sidebar.settings'] > button[aria-haspopup='dialog'] {
  width: 36px !important;
  height: 36px;
  margin: 8px auto 10px !important;
  padding: 0 !important;
  border-radius: 50%;
}

body[data-dsh-liquid-glass] [data-slot='sidebar.settings'] > [role='presentation'] {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

`
