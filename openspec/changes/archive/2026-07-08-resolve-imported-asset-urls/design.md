# Design

## Context

Display Case bundles each case with `Bun.build` and serves the output as static
files. The dev server streams bundler output from a `/dist/` mount
(`server.ts`); a published build serves it from a `<base>/assets/` mount
(`prod-server.ts`). The render document loads the entry bundle from that mount
(`<script src="/dist/browser-entry.js">`), and the bundle in turn pulls in the
per-case render chunk.

When a case imports a static asset (`import photo from './photo.jpeg'`), Bun's
`file` loader emits the asset as a content-hashed file into the build's `outdir`
and rewrites the import to a **string URL**. The build already emits the bytes to
the right directory and the static handler already serves that directory — the
only missing link is what URL the rewrite produces.

## Decision: pass `publicPath` to every `Bun.build`

`Bun.build` accepts a `publicPath` that becomes the prefix of every emitted
asset URL. With none set, Bun emits a **document-relative** URL (`"./photo-<hash>
.jpeg"`), which the browser resolves against the render document's path
(`/render/<component>/…`) — not the `/dist/` (or `/assets/`) mount the file lives
at — so it 404s. Verified empirically on Bun 1.3.14:

```
no publicPath   → var photo = "./photo-6kt9k1q8.jpeg"
publicPath /dist/ → var photo = "/dist/photo-6kt9k1q8.jpeg"
```

So each build passes the mount that serves its output as `publicPath`:

- **Dev** (`build-case.ts`): `'/dist/'` on the per-case browser + SSR builds and
  the shell browser + primer-SSR builds.
- **Publish** (`publish.ts` → `PublishBuildRequest.publicPath`): `` `${base}/assets/` ``
  on the vendor, chrome, per-component browser, and SSR builds — the same prefix
  the importmap and asset URLs already use (`${base}/assets/${basename}`).

### Why the SSR (`target: 'bun'`) builds get it too

The SSR bundle renders the case's markup server-side, so its emitted `<img src>`
must be a URL the *client* document can fetch. The content hash is a pure
function of the asset bytes, so the browser build and SSR build produce the
**same** hashed filename; giving both the same `publicPath` makes the
server-rendered `src` and the hydrating client reference identical URLs, and the
browser build is the one that emits the served bytes into the `/dist/` (or
`/assets/`) directory. Without matching `publicPath`, SSR markup and client
bundle could disagree.

## Alternatives considered

- **Serve `/dist/` assets under the document path too** — add a dev fallback that,
  for an unknown `/render/<component>/<file>.<ext>`, tries `outdir/<file>.<ext>`.
  Hacky, dev-only, and leaves the published build unaddressed. `publicPath` is the
  bundler's designed mechanism and fixes both surfaces uniformly.
- **Inline small assets as `data:` URIs** (`loader: { '.png': 'dataurl' }`) —
  sidesteps URL/serving entirely but bloats the JS bundle and diverges from how
  the consumer app renders the same component. Rejected as the default.

## Non-goals

- Changing which files a build emits, the render document templates, or the
  static serving routes — all unchanged; only the emitted URL prefix moves.
- Configurability of the asset strategy (dataurl thresholds, etc.).
