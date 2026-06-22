# AI agents

> Nav: [Quick start](quick-start.md) · [Writing cases](writing-cases.md) · [Hierarchy](hierarchy.md) · [Tweaks](tweaks.md) · [Theming](theming.md) · [Documentation panel](documentation-panel.md) · [Writing placard docs](writing-placard-docs.md) · [Testing](testing.md) · [CLI](cli.md) · **AI agents** · [Configuration](configuration.md)

Display Case is built to be read by machines as easily as by people. Two facts make it agent-friendly:

1. A single **manifest** enumerates every component, case, doc, and tweak — as file references, not inlined content.
2. Every case has a **deterministic render URL** that produces exactly one variant in isolation.

Together these let an agent discover what exists, read the source it points to, and snapshot any single state reproducibly.

## Running the tool

Display Case requires Bun. Invoke it with `bunx @awarebydefault/display-case <pkgDir>` (or wrap it in a `bun run display-case` npm script — see [CLI](cli.md)).

- **Enumerate without a browser or server:** `bunx @awarebydefault/display-case <pkgDir> --print-manifest` prints the manifest JSON to stdout and exits. This is the cheapest way to discover what exists.
- **Start the server** (needed for `/render`, `/manifest.json`, `/doc`): `bunx @awarebydefault/display-case <pkgDir>` serves at `http://localhost:3100` (override with `--port`). It needs no database or app — only the showcased package. It runs until killed.
- **Accessibility result for a variant** (only when `a11y.enabled`): `GET /a11y?component=<id>&case=<id>&theme=light|dark` returns `{ status: 'ok', violations: [{ id, help, nodes, impact, details? }] }` when cached, `{ status: 'pending' }` when a scan was just enqueued (poll again, or it's pushed over the SSE stream as an `a11y` event), or `{ status: 'unavailable', reason }` when the scan toolchain can't run. The headless CI form is `display-case check --a11y` (exits non-zero on any violation).
- **Read the full a11y findings without re-running:** `display-case check --a11y` prints each violation's affected nodes and writes the complete run to `.display-case/a11y/last-check.json` — `{ scannedAt, total, results: [{ component, case, theme, violations }] }`, where each violation carries `details: [{ target, html, failureSummary?, contrast?: { foreground, background, ratio, required, fontSize?, fontWeight? } }]`. For a colour-contrast finding this is the exact element and failing pair; read this file to fix violations without driving a browser yourself.
- **Rasterize a render:** `/render/...` returns a complete **HTML document**, not an image. To capture it, drive a headless browser with Playwright:
  ```ts
  const page = await browser.newPage()
  await page.goto('http://localhost:3100/render/tweak-control/playground?theme=dark')
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'tweak-control-dark.png' })
  ```

## The manifest is a directory, not a dump

`/manifest.json` (or `--print-manifest`) returns a lightweight index. It contains *paths* to the real artifacts, so an agent reads the manifest first, then opens only the files it needs.

```jsonc
{
  "title": "Display Case",
  "components": [
    {
      "id": "tweak-control",
      "name": "TweakControl",
      "level": "atom",
      "isFlow": false,
      "caseFile": "src/components/tweak-control.case.tsx",
      "placardDoc": "src/components/tweak-control.placard.md",
      "cases": [
        {
          "id": "variants",
          "name": "Variants",
          "browseUrl": "/c/tweak-control/variants",
          "renderUrl": "/render/tweak-control/variants",
          "tweaks": null,
          "transitions": []
        },
        {
          "id": "playground",
          "name": "Playground",
          "browseUrl": "/c/tweak-control/playground",
          "renderUrl": "/render/tweak-control/playground",
          "tweaks": {
            "label": { "kind": "text", "default": "Variant" },
            "kind": { "kind": "choice", "options": ["text", "boolean", "number", "choice"], "default": "choice" },
            "disabled": { "kind": "boolean", "default": false }
          },
          "transitions": []
        }
      ]
    }
  ]
}
```

Per component you get its `level`, `isFlow`, the package-relative `caseFile`, and the package-relative `placardDoc` (or `null`). Per case you get its `browseUrl`, its `renderUrl`, the declared `tweaks` schema (or `null`), and its `transitions` — the slugified ids of steps it can advance to (a flow's steps; `[]` for a regular case).

## Snapshotting a single case

`renderUrl` points at the isolated render document — the same one the browse iframe embeds and the check runner screenshots. It accepts query parameters so an agent can pin an exact state:

```
/render/tweak-control/playground?theme=dark&width=480&t.label=Variant&t.kind=choice&t.disabled=1
```

| Parameter | Meaning |
| --- | --- |
| `theme=light\|dark` | Sets `data-theme` on the document root. Anything but `dark` is light. |
| `width=<px>` | Constrains the render to a centered `max-width` container. |
| `t.<name>=<value>` | Sets a tweak. `boolean` → `1`/`true`; `number` → numeric; text/choice verbatim. Missing values fall back to defaults. |

Because the state lives entirely in the URL, the same URL always produces the same render — ideal for deterministic screenshots and diffs. See [Tweaks](tweaks.md) and [Theming](theming.md) for the encoding rules.

## Reading docs

If `placardDoc` is non-null, the raw Markdown is served verbatim at `/doc/<component>` (content type `text/markdown`). An agent can fetch it directly for usage guidance, or just read the `placardDoc` path from the filesystem. See [Documentation panel](documentation-panel.md).

To *write* a `placardDoc` rather than read one, follow [Writing placard docs](writing-placard-docs.md) — the bundled `display-case-author-placard-doc` skill drives exactly that workflow.

## Endpoints

The dev server exposes:

| Path | Returns |
| --- | --- |
| `/` and `/c/<component>/<case>` | The browsing shell (client-side routed). |
| `/render/<component>/<case>` | The isolated render document (accepts `theme`, `width`, `t.*`). |
| `/manifest.json` | The manifest described above. |
| `/doc/<component>` | The raw `.placard.md` for that component (404 if none). |
| `/health` | `ok`. |

## Render isolation & bundling

Cases render in an isolated browser bundle, which shapes a few behaviors worth knowing when a render looks wrong:

- **Public env is inlined.** The bundle inlines the consumer package's `BUN_PUBLIC_*` env (from `<pkg>/.env[.local]`) via `Bun.build`'s `define`, mirroring the app's own build. So app code that reads `process.env.BUN_PUBLIC_*` (e.g. an API base URL) gets a value instead of throwing `process is not defined` and blanking the whole single-bundle showcase. Non-public env is **not** inlined — a bundled module that reads `process.cwd()`, `process.env.NODE_ENV`, `Bun.*`, etc. still throws.
- **Runtime-global guard.** If a bundled module does reference an undefined Node/Bun global at load, the render document catches it and paints an explanatory banner (instead of a silent blank).
- **No frame navigation.** Anchor clicks that would unload the isolated frame are neutralized (a case has no router); same-document `#hash` links and `target=_blank` are left alone.

## Scaffolding integration (`init` / `uninstall`)

`display-case init [pkgDir] [--agent=claude] [--with-visual] [--dry-run] [--json]` wires Display Case into a repo: it merges a launch entry into the agent's launch config, installs the bundled skills, and adds an agent-guide pointer — idempotently. A re-init is self-healing: skills, the launch entry, and the sentinel-delimited pointer block are each reconciled against the bundled content, so a drifted artifact is refreshed (reported as `updated`) rather than skipped. `display-case uninstall` reverses exactly those, removing only Display Case's own artifacts. Both default to a human-readable report; pass `--json` to get a machine-parsable plan/report (`{ command, agent, dryRun, items: [{ artifact, action, detail }] }`) and `--dry-run` to preview without writing.

`--with-visual` additionally sets up the optional visual-regression toolchain — it runs `bun add --dev playwright @axe-core/playwright pixelmatch pngjs` then `bunx playwright install chromium`. Without the flag the step is skipped (reported as a `skipped` plan item); when run interactively in a TTY, `init` prompts for it. You need this only for a **default-backed `check`** — browsing, `--print-manifest`, and `/render` snapshotting need no browser or visual deps. See [Testing → the default backend is lazy and optional](testing.md#the-default-backend-is-lazy-and-optional).

## Recommended agent workflow

1. **Enumerate.** Run `bunx @awarebydefault/display-case <pkgDir> --print-manifest` (no server needed), or `GET /manifest.json` against a running server.
2. **Locate.** From the manifest, pick the `caseFile` / `placardDoc` paths to read for source and guidance, and note each case's `renderUrl` and `tweaks`.
3. **Snapshot.** Hit `renderUrl` with the desired `theme`, `width`, and `t.*` parameters to render exactly the variant you want — then screenshot or scrape it.
4. **Document.** When a component has no `placardDoc` (or a thin one), author `<name>.placard.md` per [Writing placard docs](writing-placard-docs.md) so the next agent can use it without reading the source.
5. **Verify.** Use `bunx @awarebydefault/display-case check <pkgDir>` to confirm the structure best-practice rules, a11y, and visual baselines still pass after a change; `bunx @awarebydefault/display-case check <pkgDir> --structure --tokens` runs just the fast, browser-free phases (see [Testing](testing.md)).
