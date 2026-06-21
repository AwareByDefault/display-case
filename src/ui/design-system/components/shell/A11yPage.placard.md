**A11y page** — the Cases chrome with accessibility surfacing on: the page that proves where a11y results appear — per-variant markers in the nav rail and the Accessibility panel below the stage.

Behaviour, by case — each is the live [A11yPanel](../showcase/A11yPanel.placard.md) and [A11yBadge](../showcase/A11yBadge.placard.md) fed a static model, so it shows one state of the surface:

- **Default** — a violations verdict: the panel lists the findings impact-sorted (worst first), nav rows carry counts.
- **Scanning** — a scan in flight: the pulsing "Scanning…" bar, no markers yet.
- **All clear** — a clean pass: the green bar, no nav markers anywhere.
- **Not configured** — a11y omitted from the model: no panel and no markers at all (the chrome exactly as before the feature).
- **Single-case leaf** — a one-variant component shows its count directly on the leaf row (never a dot).
- **Per-variant breakdown** — an expanded component shows a plain dot while its case rows carry the per-variant counts; collapsed siblings show their summed count.
- **Scrolling** — a long violation list scrolls inside the height-capped panel, under the sticky header.
- **Re-scan** — the panel's ⟳ control forces a fresh audit: flips to "Scanning…", then resolves (mirrors the live `rescanA11y`).
- **With tweaks and docs** — the panel coexisting with the Tweaks and Docs panels on a crowded page.

For how the live server feeds these states (on-demand scan, cache, SSE), see the package's Configuration guide (the `a11y` option) and the `display-case-live-a11y` change.
