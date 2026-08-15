    // Layer: Scroller clip, viewArea, chat-flow, seat, trajectory floor.
    var cssConversationScroll = String.raw`
/* Inset the official scroller so its stable gutter/scrollbar sit inside the
   transcript island. Do not touch overflow or scrollbar-gutter. clip-path
   (not overflow) keeps fast-scroll pixels inside the island; the 3px top
   inset is the title/pane gap so text cannot paint into G. */
body[data-dsh-liquid-glass] [data-conversation-scroll] {
  margin-inline: var(--lg-pane-gutter);
  margin-bottom: var(--lg-pane-gutter);
  border-radius: 0 0 var(--lg-radius-shell) var(--lg-radius-shell);
  clip-path: inset(var(--lg-pane-gutter) 0 0 0 round var(--lg-radius-shell));
}

body[data-dsh-liquid-glass] [data-slot='conversation'] > [data-phase='hero'] [data-conversation-scroll] {
  clip-path: inset(0 round var(--lg-radius-shell));
}

body[data-dsh-liquid-glass] [data-conversation-scroll]:has([role='tooltip']) {
  clip-path: none;
}

/* viewArea — content inset only. Shell lives on ConversationRoot::before. */
body[data-dsh-liquid-glass] [data-slot='conversation.session'] > :first-child:not(:has([data-conversation-composer-overlay])) {
  padding: 20px 16px 8px;
}

/* ChatView exposes one stable flow node. MetricsBridge updates these two
   insets against the actual scrollport and sticky composer rectangles, so
   transcript pixels are genuinely clipped at both viewport edges instead of
   being covered by an opaque colour slab. Trajectory does not have this node. */
body[data-dsh-liquid-glass] [data-conversation-scroll] [data-chat-flow] {
  box-sizing: border-box;
  padding-bottom: 6px;
  clip-path: inset(
    var(--lg-chat-clip-top, 0px)
    0
    calc(var(--lg-chat-clip-bottom, 0px) + var(--lg-pane-gutter))
    0
  );
}

/* clip-path is a fixed containing block. Official tooltips sit next to the
   anchor with position:fixed and no portal, so they vanish inside the clip.
   Drop the clip only while a bubble is open in this flow. */
body[data-dsh-liquid-glass] [data-conversation-scroll] [data-chat-flow]:has([role='tooltip']) {
  clip-path: none;
}

body[data-dsh-liquid-glass] [data-slot='conversation.session'] > :first-child:has([data-conversation-composer-overlay]) {
  padding: 12px 24px;
}

@media (max-width: 800px) {
  body[data-dsh-liquid-glass] [data-slot='conversation.session'] > :first-child:not(:has([data-conversation-composer-overlay])),
  body[data-dsh-liquid-glass] [data-slot='conversation.session'] > :first-child:has([data-conversation-composer-overlay]) {
    padding-inline: 16px;
  }
}

/* Composer seat: do not write position / bottom / z-index / sticky.
   Official fade and our old edge-mask painted a full-width slab behind
   the input card and stats dock. Transcript clip already stops at the
   seat; the conversation island is the floor. */
body[data-dsh-liquid-glass] [data-composer-seat] {
  background: transparent;
}

/* Same inner gap as Chat: last ledger pixels stop pane-gutter above the
   input island. Official --dsh-composer-height is published on the scroller. */
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] {
  --dsh-trajectory-bottom-clearance: var(--dsh-composer-height, 152px);
  clip-path: inset(0 0 var(--dsh-composer-height, 152px) 0);
}

body[data-dsh-liquid-glass] [data-conversation-composer-overlay]:has([role='tooltip']) {
  clip-path: none;
}

/* Official trajectory paints --dsw-alias-bg-layer-1 on the host, toolbar,
   split, and the table itself. Clear those floors; row hover/chips stay. */
body[data-dsh-liquid-glass] [data-conversation-composer-overlay],
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] > *,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] > :last-child,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] > :last-child > *,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] section,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] section > *,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] table,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] thead,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] tbody,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] tr,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] th,
body[data-dsh-liquid-glass] [data-conversation-composer-overlay] td {
  background-color: transparent;
}
`
