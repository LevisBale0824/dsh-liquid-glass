    // Layer: Stats dock, tool/plan/goal cards, inline code.
    var cssCards = String.raw`
/* StatsLine — official 12/20 type. No locked 36px height so the dock
   stays short and the sticky composer stack sits lower. */
body[data-dsh-liquid-glass] [data-slot='conversation.composer.dock'] > :first-child {
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  padding: 4px 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 20px;
  background: var(--lg-control-bg);
  -webkit-backdrop-filter: blur(var(--lg-blur-card)) saturate(145%);
  backdrop-filter: blur(var(--lg-blur-card)) saturate(145%);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-radius-control);
  box-shadow: inset 0 1px 0 var(--lg-highlight);
}

/* Tool / command / permission rows stay official. Do not wrap them. */

/* Markdown inline code in the transcript only — settings cards keep
   official chips (e.g. the agent-preset id). */
body[data-dsh-liquid-glass] [data-slot='conversation'] :not(pre) > code {
  background: var(--lg-control-bg);
  color: var(--lg-text-primary);
  border: 1px solid var(--lg-border);
  border-radius: 8px;
  box-shadow: inset 0 1px 0 var(--lg-highlight);
}
`
