import { ShellView } from './design-system/components/shell/ShellView'
import { DcTestIds } from './test-ids'
import { type ShellSeed, useShell } from './use-shell'

/**
 * The browse chrome's container. It runs the {@link useShell} state machine and
 * hands the resulting view model to the pure {@link ShellView}, supplying the
 * one thing a view model can't carry across the app/exhibit boundary: the live
 * `<iframe>` elements (the render stage and the Primer reading page). In a
 * page/flow exhibit those slots are static stand-ins instead — same view, no
 * server. Until the manifest loads (and when it's empty) the container shows the
 * loading/empty screens rather than the chrome.
 */
export function Shell({ seed }: { seed: ShellSeed }) {
  const vm = useShell(seed)
  if (!vm.manifest) return <div className="dc-loading">Loading…</div>
  if (vm.manifest.components.length === 0) {
    return (
      <div className="dc-empty">
        <p>No cases found.</p>
        <p className="dc-empty-hint">
          Add a <code>*.case.tsx</code> file to get started.
        </p>
      </div>
    )
  }

  // The live render stage: one iframe, loaded once at a fixed src; the hook
  // pushes every later change in via postMessage so it never reloads/flickers.
  const renderFrame = (
    <iframe
      ref={vm.frameRef}
      title="preview"
      data-testid={DcTestIds.stageFrame}
      className="dc-frame"
      style={{
        width: `${vm.targetW}px`,
        height: `${vm.renderH}px`,
        transform: vm.scale === 1 ? undefined : `scale(${vm.scale})`,
        transformOrigin: 'top left',
      }}
      src={vm.frameSrc ?? undefined}
    />
  )

  // The Primer reading page: its own isolated iframe, created lazily the first
  // time the Primer view is opened (so `primerSrc` is null until then).
  const primerFrame = vm.primerSrc ? (
    <iframe
      ref={vm.primerRef}
      title="Primer"
      className="dc-primer-frame"
      src={vm.primerSrc}
    />
  ) : null

  return (
    <ShellView {...vm} renderFrame={renderFrame} primerFrame={primerFrame} />
  )
}
