# v1.9.9 mobile UI checklist

- Skill Storage X/backdrop close uses v1.9.9 capture handler.
- Skill list/detail/editor use one mobile surface at a time.
- Skill mobile back returns to the list without mutating stored skill data.
- Continuity tabs remain the existing seven engine-owned tabs.
- Continuity mobile tab rail uses horizontal pan; body uses vertical pan.
- Close controls are 44–46px minimum and sit above decorative layers.
- Safe-area insets and 100dvh are applied on mobile.
- No AI/API generation is added by the UI shell.
