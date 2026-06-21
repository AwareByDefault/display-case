**Primer to Cases** — Display Case's own Primer ↔ Cases view change, walked as a flow. The headline dogfood: the same pure `ShellView` the live chrome renders, fed a static model per step.

Steps, in order: `primer-view` (reading mode — the Primer wall text with live specimens) ↔ `cases-view` (the library — a component on the stage).

Advances when: the sidebar's **Primer / Cases mode switch** is clicked — each step wires it to the flow's `goto`, so clicking it transitions to the other step exactly as the live chrome crossfades between the two views. A two-step loop with no terminal state: walk it in either direction, or deep-link to a single step to snapshot just that view.
