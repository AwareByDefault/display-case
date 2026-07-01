## Context

The tweaks controls panel is a controlled component (`TweaksPanel.tsx`) with a
`mode: 'docked' | 'floating'` prop. The browse-chrome shell hook
(`src/ui/use-shell.ts`) owns the docking state as a single boolean,
`const [tweaksFloating, setTweaksFloating] = useState(false)`. Today that
default is hardcoded to docked, is never persisted, and is only ever flipped by
the header toggle button (`ShellView.tsx`). Nothing measures the case against
the viewport to influence it.

Two existing facts constrain the design:

1. **The initial docking value must be deterministic across SSR and hydration.**
   The shell deliberately seeds layout-ish state (`navCollapsed`, `sidebarWidth`,
   and `tweaksFloating`) with fixed `useState` values so the server render and
   the first client render agree. Any size-driven decision must therefore run in
   a post-mount effect, not in the initial state.
2. **The available preview area is already measured.** `attachPreview` attaches a
   `ResizeObserver` to the preview container and writes its inner box to the
   `panel` state (`{ w, h }`), used for fit-to-panel scaling. This is the
   available space, *not* the case's natural (unscaled) height — the case renders
   inside the stage iframe.

## Goals / Non-Goals

**Goals:**
- When a docked panel would leave a case too tall to fit, place the panel
  undocked instead, so the whole case stays visible.
- Decide placement by size **per case** while the viewer has not overridden it;
  a manual dock/undock locks the placement for the rest of the current page load
  (not persisted — a reload returns to per-case size-based placement).
- Present the panel already in its resolved placement — no visible docked↔floating
  flicker as a result of the automatic decision.
- Keep server-rendered output and first paint unchanged (no hydration mismatch).

**Non-Goals:**
- No change to the authoring API, manifest, tweak encoding, or the chrome-free
  `/render` endpoint.
- Not persisting the docking choice across reloads (out of scope; each load
  starts from the size-driven default again).
- Not auto-*re*-docking a case that shrinks *after* it is shown, nor overriding
  an explicit choice — the automatic path only chooses placement per case
  selection, and only until the viewer overrides.

## Decisions

### Decision 1: An explicit-override flag promotes size-driven placement to a session lock

Add a companion flag (e.g. `tweaksDockUserSet`) that starts `false` and is set
`true` the first time the header dock/undock toggle fires. Behavior splits on it:

- **Flag `false` (no manual override):** the size-based rule owns placement and
  is re-evaluated **per case** — selecting a new case recomputes docked vs.
  floating from that case's height.
- **Flag `true` (manual override):** the viewer's last explicit placement holds
  for the rest of the current page load; it persists across case selections and
  the size-based rule no longer runs.

This is exactly the spec's two-mode contract ("per-case until an explicit
choice, then locked for the page load"). The flag is plain in-memory React
state — no `localStorage`/`sessionStorage`, no URL encoding — so it never
re-arms while the page is open, but a reload starts fresh with the flag `false`
and placement decided by size again (matching the non-goal on persistence).

This rests on how the shell navigates: selecting a component/case/mode is a
client-side `window.history.pushState` + `setSel` in `use-shell.ts` (the stage
frame is updated via postMessage, never reloaded), so the app does not remount
and in-memory state carries across selections. Only a genuine page reload
resets it. Consequently the selection handler MUST NOT clear the override flag —
"persists across case selections" and "reset on reload" are the *same*
mechanism (React state surviving pushState but not a reload), not two separate
behaviors to implement.

*Alternative considered — a per-case ref guard that auto-defaults once per
selection:* still needed in spirit (see Decision 3, re-evaluate on case change),
but it is *not* the override mechanism — the boolean override flag is what
distinguishes "the user has spoken" from "recompute for this case."

### Decision 2: Prefer a synchronous height signal to guarantee no flicker

The panel must appear already in its correct placement — the viewer must never
see it dock and then jump to floating. That requirement drives the height source:

- **(a) Reuse the stage's existing sizing math (preferred).** The stage already
  derives `renderH` and scales content to `panel.h` for fit-to-panel display, and
  `panel` is measured by a `ResizeObserver` that fires before paint. If the
  case's natural height (or the overflow relationship natural-height vs.
  `panel.h` minus the docked panel footprint) is derivable from values already
  computed there, the placement can be resolved **synchronously in the same
  commit** the panel becomes visible — no round-trip, no flicker.
- **(b) A content-height report from the stage iframe via postMessage (fallback).**
  Mirrors the `dc-primer-*` pattern. This is inherently async (a cross-frame
  round-trip), so it introduces a frame where the height is unknown. To honor the
  no-flicker requirement under (b), the panel's *placement* (equivalently, its
  visibility in a placement) MUST be withheld until the first height message
  arrives — resolve placement, then reveal — rather than showing it docked and
  correcting.

Prefer (a). Choose (b) only if the natural height is genuinely not derivable
synchronously, and pair it with the withhold-until-measured guard above. Either
way the comparison is `naturalCaseHeight > (panel.h − dockedPanelFootprint)` →
place undocked.

### Decision 3: Gate the effect on a real measurement; re-evaluate per case

`panel` seeds to `{ w: 0, h: 0 }` before the observer fires. The size-based
resolution must no-op until a non-zero height exists so it never mis-places on
the pre-measure frame. While the override flag is `false`, it re-evaluates when
the measured height or the selected case changes, so a newly selected tall case
is placed undocked and a newly selected short one docked. While the flag is
`true`, it does nothing.

## Risks / Trade-offs

- **[Flicker: dock-then-jump on open]** The primary risk the design guards
  against. → Prefer the synchronous height signal (Decision 2a) so placement is
  decided in the same commit the panel appears; under the async fallback (2b),
  withhold the panel's placement until the first measurement arrives.
- **[Threshold ambiguity — "taller than available space"]** A case that fits by
  a few pixels shouldn't thrash between placements across re-evaluations. →
  Compare against `panel.h` minus the docked panel footprint with a small
  tolerance; the comparison is a single deterministic predicate per case, not a
  continuous animation-driven one.
- **[Re-evaluation surprising the viewer]** Per-case recomputation is intended
  *only* before the viewer overrides; once they dock/undock manually the flag
  locks placement for the current page load, so switching cases never silently
  moves a panel they positioned. This is by design (Decision 1), not a residual
  risk.
- **[Browser-only path]** All of this is interactive chrome; it must stay out of
  the render path so SSR determinism and the ssr check are unaffected. The
  post-mount effect placement satisfies this.

## Open Questions

- Is the case's natural height derivable **synchronously** from the stage sizing
  math (Decision 2a) — the flicker-free path — or is a `dc-stage-height`
  postMessage needed (2b, requiring the withhold-until-measured guard)? Resolve
  by inspecting the stage sizing values during implementation.
