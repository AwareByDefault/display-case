import { defineConfig } from '@awarebydefault/display-case'

/**
 * A dummy consumer for the imported-asset spec (asset.spec.ts). It ships one
 * component that imports a static image asset and renders it in an `<img>` — the
 * exact shape that regressed (a broken image in the isolated render, because the
 * bundler rewrote the import to a document-relative URL that 404'd). The spec
 * drives it in a real browser and asserts the image actually loads, so the fix
 * (`publicPath` on every build) is covered end-to-end, not only at the linker.
 */
export default defineConfig({
  title: 'Imported Asset Consumer',
  roots: ['src/**/*.case.tsx'],
})
