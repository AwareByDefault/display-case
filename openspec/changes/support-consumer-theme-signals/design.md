## Context

Display Case applies the preview theme by writing, on `<html>`, a `data-theme`
attribute (which its own `--dc-*` tokens key off) and the CSS `color-scheme`
property, both baked into the delivered document before scripting and re-applied by
the client on an in-place toggle. The seams that write these today:

- **Server (string):** `src/render/documents.ts` (`shellDoc`/`renderDoc`/
  `primerDoc`) and `src/server/server.ts` (shell, isolated render, build-error,
  primer templates) — 7 sites, value from a `Theme` (`'light' | 'dark'`).
- **Client (DOM):** `src/ui/render-mount.tsx` `applyDocEffects`, `src/ui/use-shell.ts`
  theme effect, `src/ui/primer-mount.tsx`, `src/ui/primer.tsx` postMessage handler
  — 4 sites — plus the per-specimen `<Display>` forced-theme wrapper.

Research into current (2025–2026) framework practice (Tailwind v3/v4, next-themes,
shadcn/ui, MUI v5/v6, Bootstrap 5.3, VueUse, Nuxt Color Mode, DaisyUI, and the CSS
`color-scheme`/`light-dark()` standard) established two facts this design rests on:

1. There is **no single standard** root signal. Components variously read a
   `data-theme` attribute, a `.dark` class, `data-bs-theme`, `data-mui-color-scheme`,
   the `color-scheme` property (via `light-dark()`), or the `prefers-color-scheme`
   media feature. The class convention is the largest single ecosystem.
2. `prefers-color-scheme` reflects the OS/user-agent setting and **cannot be forced
   by a served page** (setting `color-scheme` does not flip it). Only test-tool
   media emulation can override it.

The relevant config precedent is `providers` (`SnapshotProviders` in `src/index.ts`):
an **inline function** (`driver?: () => RenderDriver`, `diff?: DiffFn`) the author
supplies, lazily used server-side by the `check` CLI. Config is otherwise loaded
**server-side only**; the sole data that crosses to the client is the inlined
`window.__dcSeed` (`{ manifest, theme, a11y }`, `src/server/server.ts` /
`src/render/documents.ts`, read in `src/ui/browser-entry.tsx`) and `__displayCase`
feature flags.

## Goals / Non-Goals

**Goals:**

- A showcased component that reads any common theme convention — directly or by
  inheriting a root signal — follows Display Case's theme toggle, with zero config
  for the common cases and opt-in config for the rest.
- The added signals are baked into the pre-scripting document *and* re-applied on
  the interactive toggle, preserving the no-flash / no-restyle guarantee the current
  `data-theme`/`color-scheme` behavior already meets.
- One source of truth for "theme → signals" shared by every server and client seam,
  so the two never drift.
- Even a component that themes *only* via `prefers-color-scheme` renders in the
  requested theme in visual baselines and a11y audits.

**Non-Goals:**

- Making a `prefers-color-scheme`-only component follow the *interactive* toggle on a
  normally-served page — a platform limitation, not implementable.
- Autodetecting which convention a consumer's components use.
- Changing case authoring, the manifest, addresses, or the published-build contract.
- Reworking Display Case's own chrome, which continues to read `data-theme`.

## Decisions

### 1. Emit a configurable multi-signal set — not autodetection

Display Case emits a set of root signals and lets the consumer widen it, rather than
trying to detect what their components read.

- **Why not autodetect:** the showcased components are arbitrary; there is no
  reliable runtime signal for "this component reads a `.dark` class." Sniffing the
  consumer's `package.json`/Tailwind config for `bootstrap`/`@mui/material`/
  `tailwindcss` is indirect, wrong when several coexist, and couples the tool to
  framework version quirks. Rejected.
- **Why multi-signal (superset) rather than "pick one":** the signals are additive
  and inert when unused — an unused `data-bs-theme` attribute is read by nothing, and
  the dark class (see Decision 3) is exactly what class-based components want. Emitting
  a superset maximizes the "browse without booting an app" payoff at near-zero cost.

### 2. Configuration is declarative serializable data — NOT an executable shim

This is the load-bearing decision, and the direct answer to "can it be a shim like
the Playwright provider?"

The `providers` precedent works because a `driver`/`diff` function runs **only
server-side**, inside the `check` CLI. A theme applier is different: it must run in
**both** the delivered document (an HTML *string* built on the server) **and** the
live client DOM (the interactive toggle, in the render iframe and the shell). An
inline function cannot straddle those:

- It cannot bake into an HTML string without executing during SSR, and a function
  that touches `document` cannot run during string building at all.
- To reach the client it would have to be serialized across `__dcSeed` — functions
  do not serialize.
- A *client-only* function shim (run in an effect) would reintroduce exactly the
  post-adopt re-theme **flash** that the recent exhibit-theme fix eliminated, because
  the server document could not pre-bake its result.

So the theme option is **declarative data**: a description of which signals to emit,
resolvable identically on the server (bake into the string) and the client (apply to
the DOM). The equivalent of a "custom shim" is a **custom declarative mapping**
(attribute name + light/dark values, or a class name), which is still fully
serializable. The resolved signal set is serialized into `__dcSeed` so the client
appliers emit the same signals on toggle that the server baked.

- **Alternative considered — inline function `theme(root, theme)`:** matches the
  `providers` ergonomics but is rejected for the straddle/serialize/flash reasons
  above. If a future need truly requires imperative logic, it belongs in a
  client-only hook with an explicit flash caveat — out of scope here.

### 3. Default set: always `data-theme` + `color-scheme`; add the dark class by default; Bootstrap/MUI/custom opt-in

- `data-theme` and `color-scheme` are **always** emitted — Display Case needs
  `data-theme` for its own chrome, and `color-scheme` is the web standard
  (`light-dark()` reads it, and it themes user-agent controls). Config cannot remove
  these.
- The **dark class** is emitted **by default** (the consumer signal), because the
  class convention (Tailwind/shadcn/next-themes-class/VueUse/Nuxt) is the largest
  ecosystem and, done dark-only (see Decision 4), is collision-safe.
- **Bootstrap** (`data-bs-theme`), **Material UI** (`data-mui-color-scheme`), and
  arbitrary **custom** attribute/class mappings are **opt-in**. They are inert when
  unused, so they *could* be default-on; they are opt-in instead to keep the root
  element uncluttered and because their audiences are smaller and typically configure
  their stack anyway. (Flagged as a reasonable thing to revisit — flipping them
  default-on is backward-compatible.)

Proposed config shape (final surface to be settled during apply):

```ts
theme?: {
  /**
   * Root theme signals emitted for showcased components, in addition to Display
   * Case's own always-present `data-theme` + `color-scheme`. Defaults to
   * ['class'] (the Tailwind/shadcn/VueUse dark-class convention). Provide a list
   * to add framework conventions or a custom mapping, or [] to emit nothing
   * beyond Display Case's own signals.
   */
  signals?: ThemeSignal[]
}

type ThemeSignal =
  | 'class'                    // toggles a `dark` class on the root (dark-only)
  | 'bootstrap'               // data-bs-theme="light|dark"
  | 'mui'                     // data-mui-color-scheme="light|dark"
  | 'data-theme'             // explicit form of the always-on attribute
  | 'color-scheme'           // explicit form of the always-on property
  | { attribute: string; light?: string; dark?: string }   // custom attribute
  | { class: string; light?: string }                       // custom class (dark-only unless `light` given)
```

### 4. The class signal is dark-only (no `.light`)

In dark mode add the class (default name `dark`); in light mode add nothing. This
matches Tailwind/shadcn/VueUse (`valueLight: ''`) exactly and avoids stamping a
`.light` class that could collide with an unrelated consumer utility of that name.
A custom class mapping MAY specify a light class if a consumer genuinely needs one.

### 5. One shared pure resolver, applied at every seam; serialized to the client

Introduce a single pure function in the render layer, e.g.
`resolveThemeSignals(theme, signals) => { attributes: Record<string,string>;
addClasses: string[]; removeClasses: string[]; colorScheme: 'light' | 'dark' }`.

- **Server seams** consume it to build the `<html …>` attributes/class and the
  `html { color-scheme: … }` rule in all 7 string sites.
- **Client seams** consume it to set/remove attributes, toggle classes, and set
  `style.colorScheme` on `documentElement` (and on the per-specimen `<Display>`
  element for its forced-theme subtree) at all 4 sites.
- The resolved `signals` config is added to `__dcSeed` (declarative, JSON-safe) so
  the client appliers emit exactly what the server baked → **no flash**.
- This also lets us **unify the existing `data-theme-pref` inconsistency** (shell
  omits it, render/primer include it) inside one resolver, rather than perpetuating
  it across seams.

### 6. `prefers-color-scheme` for capture only, via media emulation

The interactive/inherited path cannot drive `prefers-color-scheme`. But the
snapshot/audit toolchain drives a real browser, so the capture driver
(`src/checks/providers/playwright-driver.ts`, shared by visual + a11y) emulates the
user-agent color-scheme preference to match each rendered theme. This closes the
coverage gap for preference-only components in baselines and audits, and is the only
place `prefers-color-scheme` can be honored. It is documented as capture-only; live
browsing of such a component still follows the OS.

## Risks / Trade-offs

- **[Dark-class collision]** A consumer's CSS could define an unrelated `.dark`
  rule. → Mitigated by dark-only application (no `.light`) and by the class name
  being overridable via a custom class mapping; the class is also disable-able by
  setting `signals` without `'class'`.
- **[Root-element clutter]** A generous signal set adds several attributes to
  `<html>`. → Inert and invisible; default keeps it to `data-theme` + `color-scheme`
  + one class. Bootstrap/MUI are opt-in.
- **[Seam drift]** Nine-plus seams must stay in lockstep. → The single shared
  resolver + a serialized `__dcSeed` signal set is the mitigation; an SSR/adopt
  parity test should assert the baked signals equal the client-applied signals.
- **[Baseline churn for consumers]** Enabling a signal a component visibly re-themes
  on changes that case's appearance. → Expected and localized; the default does not
  affect Display Case's own chrome, so this repo's baselines are unaffected by the
  default.
- **[Config surface creep]** A new declarative type on the public config. →
  Additive and small; the `ThemeSignal` union is closed except for the deliberate
  custom escape hatch.

## Open Questions

- Should Bootstrap/MUI be default-on (they are inert when unused) rather than opt-in?
  Current lean: opt-in, revisitable.
- Final naming of the config field and the `ThemeSignal` union (settle during apply,
  in step with `src/index.ts` conventions).
- Whether the capture-time `prefers-color-scheme` emulation should ship in the same
  change or as an immediate fast-follow, given it touches the check toolchain rather
  than the render path.
