# Display Case Specifications

Display Case is a development-only tool for browsing, documenting, and checking a project's UI components. It discovers component cases colocated with their components, presents them on a calm browsing surface grouped by design hierarchy, and renders each case in isolation so it can be deep-linked, tweaked, snapshotted, and audited for accessibility and visual regressions. It also exposes a machine-readable catalog and isolated render endpoints so AI agents can enumerate and capture components without the browsing chrome.

The specification is split into discrete, per-capability files. Each describes the observable behavior of one capability.

- **Discovery and Manifest** — discovers colocated case files and exposes a machine-readable catalog of every component and case. [discovery-and-manifest/spec.md](./discovery-and-manifest/spec.md)
- **Hierarchy** — groups components by their declared design-hierarchy level, atom through flow. [hierarchy/spec.md](./hierarchy/spec.md)
- **Browsing Surface** — lists components, renders a selected case in isolation, and gives each case a stable, deep-linkable address. [browsing-surface/spec.md](./browsing-surface/spec.md)
- **Theming and Viewport** — switches the preview between light and dark themes and constrains it to a chosen viewport width. [theming-and-viewport/spec.md](./theming-and-viewport/spec.md)
- **Tweaks** — interactive, typed controls whose values are encoded in the case's address for sharing and reproduction. [tweaks/spec.md](./tweaks/spec.md)
- **Placard Docs** — an inline documentation panel that renders a component's authored usage documentation. [placard-docs/spec.md](./placard-docs/spec.md)
- **Render Endpoint** — an isolated, chrome-free rendering of each case honoring a requested theme, for snapshotting. [render-endpoint/spec.md](./render-endpoint/spec.md)
- **Flows** — ordered, named steps demonstrating a behavioural page or user flow, with optional in-step transitions. [flows/spec.md](./flows/spec.md)
- **Primer** — an authored long-form reading surface interleaving prose with live component specimens. [primer/spec.md](./primer/spec.md)
- **Showcase Location** — locates the showcase to run and anchors derived state so independent working copies don't collide. [showcase-location/spec.md](./showcase-location/spec.md)
- **Live Reload** — reflects edits to cases, docs, primer, and component implementations while running. [live-reload/spec.md](./live-reload/spec.md)
- **Accessibility Checks** — gating accessibility checks plus optional in-app surfacing of each variant's result. [accessibility-checks/spec.md](./accessibility-checks/spec.md)
- **Visual-Regression Checks** — renders each case to an image and compares against a baseline, with an overridable, optional-backend pipeline. [visual-regression-checks/spec.md](./visual-regression-checks/spec.md)
- **Structure Checks** — static best-practice checks over a showcase's authored material and configuration, with configurable phases, severities, and exemptions. [structure-checks/spec.md](./structure-checks/spec.md)
- **Server Rendering** — delivers every surface rendered before scripting, plus a server-render safety check. [server-rendering/spec.md](./server-rendering/spec.md)
- **Agent Init** — installs and removes Display Case's AI-agent integration into a target repository, idempotently. [agent-init/spec.md](./agent-init/spec.md)
- **Publishing** — keeps Display Case out of consuming applications while producing a standalone, deployable showcase build. [publishing/spec.md](./publishing/spec.md)
- **Change-Scoped Checks** — restricts the gating render checks (a11y, visual) to the components a change could affect, derived from each component's import closure, with a conservative fallback to all. [change-scoped-checks/spec.md](./change-scoped-checks/spec.md)
- **Continuous Integration** — runs the repository's full quality suite against every proposed change before it can be integrated. (Repository engineering process, not Display Case runtime behavior.) [continuous-integration/spec.md](./continuous-integration/spec.md)
