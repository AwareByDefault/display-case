/**
 * Self-contained styling for the design-system components: each component calls
 * `injectStyle` at module load to append its own `<style>` once. This keeps the
 * components portable (a single import brings its markup *and* its CSS) and
 * matches the source design system's pattern. No-ops under SSR / Node (the
 * codegen imports these modules where `document` is undefined).
 */
export function injectStyle(id: string, css: string): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(id)) return
  const el = document.createElement('style')
  el.id = id
  el.textContent = css
  document.head.appendChild(el)
}
