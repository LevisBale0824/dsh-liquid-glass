    // Layer: free-crop modal for imported wallpapers. Mounts in shell.overlay
    // so it escapes the settings dialog's stacking context (dialog is fixed
    // at z-index 1000; this modal uses a higher z-index and is body-level).
    var cssCrop = String.raw`
[data-liquid-glass-crop] {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
}

[data-liquid-glass-crop-backdrop] {
  position: absolute;
  inset: 0;
  background: rgba(6, 10, 18, 0.55);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

[data-liquid-glass-crop-panel] {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(92vw, 680px);
  max-width: 92vw;
  max-height: 88vh;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 16px;
  border: 1px solid var(--lg-border-strong);
  background: var(--lg-overlay-bg);
  box-shadow: var(--lg-shadow-card);
  color: var(--lg-text-primary);
  overflow: hidden;
}

[data-liquid-glass-crop-head] {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
}

[data-liquid-glass-crop-name] {
  font-size: 12px;
  color: var(--lg-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 55%;
}

[data-liquid-glass-crop-stage] {
  position: relative;
  margin: 0 auto;
  max-width: 100%;
  max-height: 56vh;
  border-radius: 12px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.28);
  background-image: repeating-conic-gradient(rgba(255, 255, 255, 0.08) 0% 25%, rgba(0, 0, 0, 0.10) 0% 50%);
  background-size: 18px 18px;
  user-select: none;
  -webkit-user-drag: none;
}

[data-liquid-glass-crop-stage] img {
  display: block;
  max-width: none;
  max-height: none;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}

[data-liquid-glass-crop-rect] {
  position: absolute;
  box-sizing: border-box;
  border: 1.5px solid #fff;
  outline: 1px solid rgba(0, 0, 0, 0.55);
  box-shadow: 0 0 0 9999px rgba(5, 9, 16, 0.45);
  cursor: move;
  touch-action: none;
}

[data-liquid-glass-crop-handle] {
  position: absolute;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.6);
  touch-action: none;
}

[data-liquid-glass-crop-handle='nw'] { left: -6px; top: -6px; cursor: nwse-resize; }
[data-liquid-glass-crop-handle='n'] { left: 50%; top: -6px; margin-left: -6px; cursor: ns-resize; }
[data-liquid-glass-crop-handle='ne'] { right: -6px; top: -6px; cursor: nesw-resize; }
[data-liquid-glass-crop-handle='e'] { right: -6px; top: 50%; margin-top: -6px; cursor: ew-resize; }
[data-liquid-glass-crop-handle='se'] { right: -6px; bottom: -6px; cursor: nwse-resize; }
[data-liquid-glass-crop-handle='s'] { left: 50%; bottom: -6px; margin-left: -6px; cursor: ns-resize; }
[data-liquid-glass-crop-handle='sw'] { left: -6px; bottom: -6px; cursor: nesw-resize; }
[data-liquid-glass-crop-handle='w'] { left: -6px; top: 50%; margin-top: -6px; cursor: ew-resize; }

[data-liquid-glass-crop-tools] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

[data-liquid-glass-crop-tools] button {
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--lg-border);
  background: var(--lg-control-bg);
  color: var(--lg-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

[data-liquid-glass-crop-tools] button[aria-pressed='true'] {
  border-color: var(--lg-border-strong);
  background: var(--lg-selected-bg);
}

[data-liquid-glass-crop-actions] {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

[data-liquid-glass-crop-actions] button {
  min-height: 32px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--lg-border-strong);
  background: var(--lg-control-bg);
  color: var(--lg-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
}

[data-liquid-glass-crop-actions] [data-liquid-glass-crop-confirm] {
  background: var(--lg-toggle-on-fill);
  color: var(--lg-toggle-on-ink);
}

@media (prefers-reduced-motion: reduce) {
  [data-liquid-glass-crop] { -webkit-backdrop-filter: none; backdrop-filter: none; }
}
`
