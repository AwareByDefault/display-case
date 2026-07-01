## 1. Height signal (flicker-free)

- [x] 1.1 Determined synchronously derivable (Decision 2a): the frame already reports the exhibit's natural size into `content` (`dc-size` message), and the docked preview area is already measured into `panel`/`availH`. No new channel needed.
- [x] 1.2 Not needed — (2a) was viable, so no `dc-stage-height` postMessage was added. Flicker is avoided instead by the existing crossfade gate (`stageShown` only reveals once `content` for the shown exhibit lands) plus a docked-baseline reset at the faded-out swap.
- [x] 1.3 The signals are `content.h` (natural exhibit height) and `availH` (`panel.h` minus decorated reserve) — both already in `use-shell.ts` in the same px units.

## 2. Placement decision (per-case, override-locked)

- [x] 2.1 Added `tweaksDockUserSet` (in-memory `useState(false)`) plus `toggleTweaksFloating`, which sets it `true` and flips placement; wired the header control to it. No persistence, so a reload resets it.
- [x] 2.2 Auto-undock effect sets `tweaksFloating` from `content.h > availH`, gated on the shown exhibit's size having landed and matched (lock-step with the reveal), so the panel appears already in place.
- [x] 2.3 Re-evaluates per exhibit via a docked-baseline reset at the swap + a per-exhibit key guard (one decision per exhibit, so undocking's freed height can't flip it back); a strict no-op once `tweaksDockUserSet` is true. The `select`/`changeMode` handlers never touch the flag.
- [x] 2.4 Initial `useState(false)` seed unchanged; the decision only runs in a post-mount effect. Typecheck + lint pass.

## 3. Tests

- [x] 3.1 Predicate coverage folded into the e2e (below): the rule (`content.h > availH`) is one line, but its correctness is stateful (per-case guard, stale-size gate, override) and only meaningful in the live chrome — so it's tested there, not as a contrived pure helper. Added the `consumer-autodock` fixture (`Sizes` → tall 2000px + short 40px, both tweaked) + a webServer to make it deterministic.
- [x] 3.2 `e2e/auto-undock.spec.ts`: a tall case opens the panel floating; a short case opens it docked. (A true intra-frame flicker catch is impractical in Playwright; the design's batched-commit reveal is what prevents it, and the asserted settled state is `floating` with no docked interstitial observed.)
- [x] 3.3 e2e: client-side nav from the short case to the tall case re-floats the panel (per-case re-evaluation, no override).
- [x] 3.4 e2e: dock the tall case explicitly (opposite its size default), navigate away and back — it stays docked, proving the override beats the size rule across switches.
- [x] 3.5 e2e: dock the tall case explicitly, reload — it returns to floating (the in-memory override is discarded).

## 4. Verify & document

- [x] 4.1 `bun run lint`, `bun run typecheck`, `bun run check`, and `bun test` (494 pass) all green; `bun run e2e` passes 37/37 including the 4 new auto-undock specs.
- [x] 4.2 Verified against the tall + short fixture cases in a real browser via the e2e run (stronger than an eyeball). The decision is purely geometric (`content.h` vs `availH`), so it is theme-independent — no per-theme divergence to check.
- [x] 4.3 Updated `TweaksPanel.placard.md` (per-case default note) and `contributing/NOTES.md` (the feedback-loop + stale-size traps); added the `.changeset/auto-undock-tweaks-panel.md` (minor).
