## Why

A showcased component that imports a static asset and renders it —
`import photo from './photo.jpeg'` then `<img src={photo} />` — shows a broken
image in the isolated render (dev `/render/…` and the published build), even
though it renders correctly in the real app. The asset **is** bundled and written
to disk, but the URL the bundler rewrites the import to is document-relative
(`./photo-<hash>.jpeg`), so it resolves against the render document's path
(`/render/<component>/…`) instead of the mount that actually serves the emitted
file. The request 404s and the image breaks.

Because Display Case is used for visual review, this reads as an *app* bug and
sends reviewers chasing a defect that does not exist in production. It blocks
faithfully reviewing any asset-backed UI — avatars, logos, illustrations.

## What Changes

- An isolated case render (dev and published) that renders a component-imported
  static asset SHALL display that asset, not a broken reference. The asset URL
  the render hands the browser SHALL point at the mount that serves the emitted
  asset bytes, so the request succeeds.
- The server-rendered markup and the hydrating client bundle SHALL reference the
  **same** asset URL, so pre-scripting content and post-hydration content agree.
- Behavior is confined to how emitted asset URLs are addressed; no change to the
  authoring API, the manifest, the render document, or which files are emitted.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `render-endpoint`: adds a requirement that a component-imported static asset is
  displayed in the isolated render — its URL resolves to the served asset in both
  the development server and a published build, and the server-rendered and
  client-rendered references agree.

## Impact

- The bundler invocation for every browser and SSR surface (dev per-case, dev
  shell/primer, and each publish build) — each now emits asset URLs prefixed with
  the mount that serves them (`/dist/` in dev, `<base>/assets/` in a publish
  build) instead of document-relative URLs.
- No change to the authoring API, the manifest, tweak encoding, the render
  document templates, or the static asset serving routes (which already served
  the bytes at those mounts).
