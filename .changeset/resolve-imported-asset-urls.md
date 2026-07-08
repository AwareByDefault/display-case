---
"@awarebydefault/display-case": patch
---

Render imported static assets instead of broken images. A showcased component
that imports an asset (`import photo from './photo.jpeg'` → `<img src={photo}>`)
now displays it in the isolated render and the published build. Every `Bun.build`
surface is passed a `publicPath` (`/dist/` in dev, `<base>/assets/` in a publish
build), so the bundler rewrites a `file`-loader import to an absolute URL that
resolves against the mount serving the emitted asset — not a document-relative
URL that resolved against `/render/<component>/…` and 404'd. The server-rendered
`<img src>` and the hydrating client bundle reference the same content-hashed URL.
