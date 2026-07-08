## 1. Dev builds address emitted assets at the `/dist/` mount

- [x] 1.1 Add a `DEV_ASSET_PUBLIC_PATH = '/dist/'` constant (documented) in
  `build-case.ts` and pass it as `publicPath` on the per-case browser build and
  the per-case SSR build.
- [x] 1.2 Pass the same `publicPath` on the shell browser build and the primer
  SSR build, so a chrome-imported asset resolves identically.

## 2. Publish builds address emitted assets at the `<base>/assets/` mount

- [x] 2.1 Add an optional `publicPath` to `PublishBuildRequest` and forward it to
  the worker's `Bun.build`.
- [x] 2.2 In `publish.ts`, compute `assetsPublicPath = ` `${base}/assets/` ` (the
  prefix the importmap/asset URLs already use) and pass it on the vendor, chrome,
  per-component browser, and both SSR builds.

## 3. Tests

- [x] 3.1 `build-case.test.ts`: the file-loader case's emitted browser bundle
  references a `/dist/`-prefixed asset URL (not `./…`), the SSR bundle references
  the same URL, and the referenced hashed file physically exists in `dist`.
- [x] 3.2 `build-case.test.ts`: a publish build with `publicPath` rewrites the
  emitted asset URL to that prefix and emits the bytes into `outdir` under the
  named hash.

## 4. Verify & document

- [x] 4.1 `bun test` (501 pass), `bun run typecheck`, `bun run lint`, and
  `bun run check` all green.
- [x] 4.2 Verified the emitted `/dist/` asset URL resolves to real on-disk bytes
  (URL prefix + hashed file existence asserted in the unit suite).
- [x] 4.3 Recorded the `publicPath` requirement + the SSR/browser hash-agreement
  trap in `contributing/NOTES.md`; added a patch changeset.
