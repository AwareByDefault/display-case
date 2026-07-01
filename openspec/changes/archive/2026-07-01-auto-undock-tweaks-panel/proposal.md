## Why

The controls panel opens docked alongside the case. When a case is taller than
the space left over with the panel open, the docked panel pushes the component
partly out of view — the viewer has to scroll or manually undock the panel just
to see what they came to see. The panel should get out of the way on its own in
exactly the situation where docking is the wrong default.

## What Changes

- When a viewer opens the controls panel on a case that is too tall to fit
  beside a docked panel, the panel SHALL present undocked (floating) instead of
  docked, so the full case stays visible.
- The auto-undock decision is a fallback default only: once a viewer manually
  docks or undocks the panel, that explicit choice SHALL be respected and the
  automatic behavior SHALL NOT override it.
- The panel's initial presentation on first paint is unchanged; the auto-undock
  applies after the layout can be measured, preserving deterministic
  server-rendered output.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `tweaks`: adds a requirement governing how the controls panel is presented
  (docked vs. floating) relative to the case's size, and that a viewer's
  explicit dock/undock choice takes precedence over the automatic default.

## Impact

- Browse-chrome shell state that owns the controls panel's docked/floating flag,
  and the size measurement it would consume.
- No change to the authoring API, the manifest, tweak encoding, or the
  chrome-free render endpoint. Behavior is confined to the interactive browse
  chrome; server-rendered output is unaffected.
