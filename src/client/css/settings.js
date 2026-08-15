    // Layer: Settings → General Liquid Glass row layout.
    var cssSettingsPage = String.raw`
/* L4 — match official General rows: 16px pad and a hairline under the block. */
[data-liquid-glass-settings] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 16px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}

[data-liquid-glass-settings] [data-liquid-glass-heading] {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}

[data-liquid-glass-head] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}

[data-liquid-glass-background-grid] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

@media (max-width: 640px) {
  [data-liquid-glass-background-grid] {
    grid-template-columns: minmax(0, 1fr);
  }
}

[data-liquid-glass-background-choice] {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background-clip: padding-box;
}

[data-liquid-glass-background-choice][aria-pressed='true'] {
  border: 1px solid transparent;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111;
}

[data-liquid-glass-import-row] {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

[data-liquid-glass-slider-row] {
  display: grid;
  grid-template-columns: 6em minmax(0, 1fr) 3.5em;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}

[data-liquid-glass-slider-row] > span {
  display: flex;
  align-items: center;
  min-height: 22px;
}

[data-liquid-glass-slider-row] > span:last-child {
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
}

[data-liquid-glass-slider-row] input[type='range'] {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 22px;
  margin: 0;
  box-sizing: border-box;
}
`
