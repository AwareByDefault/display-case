/**
 * `@awarebydefault/display-case/substrate` — the built-in DOM substrate.
 *
 * Separate from `./core` on purpose. `./core` is the substrate-*neutral*
 * surface a new substrate is written against, and is guaranteed DOM-free and
 * server-free (enforced by a module-graph test). The DOM substrate is an
 * *implementation*: it pulls in `react-dom/server`, the document templates, and
 * the chrome's viewport presets, so exporting it from `./core` would break the
 * very property that makes `./core` useful.
 *
 * Import from here to configure the default substrate rather than replace it:
 *
 * @example
 * import { defineConfig } from '@awarebydefault/display-case'
 * import { domSubstrate } from '@awarebydefault/display-case/substrate'
 *
 * export default defineConfig({
 *   title: 'My kit',
 *   roots: ['src/**\/*.case.tsx'],
 *   substrate: domSubstrate({ driver: () => myDriver() }),
 * })
 */

export type { DomFrame, DomSubstrate, DomSubstrateOptions } from './dom'
export { domSubstrate } from './dom'
export { renderVariants, resolveSubstrate } from './resolve'
