# Character Life v1.9.9 — Skill Storage & Continuity UI Rebuild

## Purpose

This release rebuilds the presentation and interaction shells for **Skill Storage** and **Continuity Hub** while preserving the existing Character Life data engines.

## Skill Storage

- Reliable X/backdrop close handling through the v1.9.9 tool shell.
- Mobile back navigation from detail/editor to the skill list.
- Character Life dossier header, accent framing, typography, technical dividers, and square controls.
- Desktop library/detail split retained.
- Mobile uses one surface at a time: list → detail/editor, with full-height vertical scrolling.
- Scope controls, search, New Skill, list selection, editor, image controls, save/delete/edit behavior remain owned by the established Skill system.

## Continuity Hub

- Character Life dossier header and shared visual language.
- Desktop uses a dedicated left-side Continuity Index and a scrollable record area.
- Mobile changes to a horizontal, touch-scrollable 48px tab rail and an independent vertical content scroller.
- Existing Overview, Knowledge, Relationships, Scene, Chronicle, Skills+, and Diagnostics tabs remain owned by the established Continuity engine.
- Keyboard arrow navigation is added for the Continuity tab list on desktop.

## Mobile safety

- Uses 100dvh full-screen shells and iOS safe-area insets.
- Minimum 44–48px primary touch targets.
- `touch-action` separates horizontal tab movement from vertical content scrolling.
- Momentum scrolling and overscroll containment are applied only to the intended scroll regions.
- Close buttons stay above decorative frames and retain pointer events.

## Stability

- This release does not replace NPC, Skill, or Continuity persistence.
- No additional AI/API call is added.
- The UI module loads after the historical cohesion layer so it owns the final visual/interaction state.
- Scoped MutationObservers watch only the two tool managers and only child-list rerenders; they do not observe `document.body`.
- Header label updates are conditional to avoid observer feedback loops.
- Failure of the v1.9.9 UI module is isolated by the bootstrap loader so the established tools can still load.
