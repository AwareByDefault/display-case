## 1. Declare the color scheme in delivered documents

- [x] 1.1 In `src/server/server.ts` `renderHtml`, add `color-scheme:${doc.theme}`
      to the document-root (`html`) rule in the static `<style>` block, so the
      isolated render's user-agent controls render in the requested theme before
      scripting.
- [x] 1.2 Apply the same `color-scheme:${doc.theme}` to the build-error render
      document (`renderErrorHtml`) so its themed body is internally consistent.
- [x] 1.3 Audit the browse/shell document template and the primer document for
      user-agent-styled surfaces (scrollbars, controls) and declare a matching
      `color-scheme` there too, so every themed surface is consistent. Done in
      both template sets: dev server `shellHtml`/`primerHtml` (`src/server/server.ts`)
      and shared `shellDoc`/`renderDoc`/`primerDoc` (`src/render/documents.ts`).

## 2. Maintain it across interactive theme changes

- [x] 2.1 In `src/ui/render-mount.tsx` `applyDocEffects`, set
      `document.documentElement.style.colorScheme = state.theme` alongside the
      existing `dataset.theme` write — idempotent on first load, correct on every
      in-place swap and in-flow transition (all route through `applyDocEffects`).

## 3. Publish / prod-server parity

- [x] 3.1 `src/server/prod-server.ts` reuses the shared `renderDoc`/`shellDoc`/
      `primerDoc` from `src/render/documents.ts`, so it inherits the fix; a
      published showcase is themed identically to the dev server.

## 4. Verification

- [x] 4.1 Unit: `src/render/documents.test.ts` asserts `color-scheme:dark` under
      `theme:'dark'` and `color-scheme:light` under `theme:'light'` for `renderDoc`,
      `shellDoc`, and `primerDoc` (the shared templates `prod-server` uses).
- [x] 4.2 Browser: against the live dev server, a `theme=dark` `/render` document
      reports `documentElement.colorScheme === 'dark'` and a bare `<button>`
      computes `rgb(107,107,107)` (dark `ButtonFace`); `theme=light` computes
      `rgb(239,239,239)`. Matches the `design.md` reproduction.
- [x] 4.3 `applyDocEffects` sets `documentElement.style.colorScheme` to the active
      theme; the in-place theme-swap path is exercised by the e2e theme-toggle
      flow (`e2e/chrome.spec.ts`, `e2e/a11y.spec.ts` re-evaluate-on-switch).
- [x] 4.4 Re-baselined the 7 dark-theme variants whose user-agent surfaces shift
      under the new color-scheme declaration: `input/withaffixes`,
      `tweakspanel/{playground,docked}`, `a11y-page/with-tweaks-and-docs`,
      `cases-page/{with-tweaks,with-tweaks-and-docs}`, and
      `primer-to-cases/cases-view`. Recorded in the same CI Linux Playwright image
      the `visual` job diffs in, via the `update-baselines` workflow (local macOS
      renders don't match the committed baselines), and committed in this PR; the
      visual CI job is green. Light variants were unaffected.
- [x] 4.5 `bun run typecheck`, `bun run lint`, `bun test` (494 pass), `bun run check`
      (structure+tokens+ssr pass), and `bun run e2e` (33 pass) all green.

## 5. Documentation

- [x] 5.1 `contributing/NOTES.md` — records that `data-theme` themes only the
      showcase's tokens; user-agent controls (default `<button>`/`<input>`,
      scrollbars) are themed by the CSS `color-scheme` property, which the render
      documents now declare from the requested theme, plus the consumer corollary
      (a low-contrast-on-a-control finding is genuine; fix it in consumer CSS, not
      via a harness-injected reset).
- [x] 5.2 Changeset added (`.changeset/cyan-walls-cheer.md`, patch).
