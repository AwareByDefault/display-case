import { defineCases } from '@awarebydefault/display-case'
import { useState } from 'react'
import type { A11yViolation } from '../../../../index'
import { Button, Input, RenderAddress } from '..'
import { ShellView } from './ShellView'
import {
  makeModel,
  mockA11y,
  mockA11yClean,
  mockA11yLeaf,
  mockA11yPending,
  mockA11yPerVariant,
  mockA11yScrolling,
  mockManifest,
  PLACEHOLDER_DOC,
  StageSlot,
  selectIn,
} from './shell-fixtures'

// The resolved audit the "Re-scan" exhibit returns to after its simulated scan.
const RESCAN_RESULT = mockA11y()

/**
 * Interactive "re-scan" exhibit: the panel's ⟳ control forces a fresh audit. We
 * simulate the live cycle locally — clicking re-scan flips the verdict to the
 * pulsing "Scanning…" state, then resolves back to the violations after a beat —
 * exactly what `useShell.rescanA11y` does against the real scanner.
 */
function RescanDemo() {
  const [current, setCurrent] = useState<
    A11yViolation[] | 'pending' | 'unavailable'
  >(RESCAN_RESULT.current)
  // Initial render = already-scanned → fade in at once; a re-scan resolves from
  // "Scanning…" → cascade (mirrors useShell driving `reveal` off the scan).
  const [reveal, setReveal] = useState<'cascade' | 'all'>('all')
  const rescan = () => {
    setReveal('cascade')
    setCurrent('pending')
    setTimeout(() => setCurrent(RESCAN_RESULT.current), 1200)
  }
  return (
    <ShellView
      {...makeModel({
        ...selectIn(mockManifest, 'input', 'default'),
        a11y: { byVariant: RESCAN_RESULT.byVariant, current, reveal },
        rescanA11y: rescan,
        boxW: 260,
        boxH: 96,
      })}
      renderFrame={
        <StageSlot>
          <Input placeholder="Email address" aria-label="Email address" />
        </StageSlot>
      }
      primerFrame={null}
    />
  )
}

/**
 * A real page proving where accessibility violations surface in the browse
 * chrome — the proposal made concrete. Two complementary surfaces:
 *
 *  - **Discoverable** — danger markers on the nav rail. Violations belong to a
 *    *variant*, so a collapsed component shows the sum across its variants;
 *    expanded, the per-variant counts move onto the case rows and the parent
 *    shows a plain dot (see the "Per-variant breakdown" case).
 *  - **Visible** — the Accessibility panel under the stage, listing the selected
 *    variant's violations (rule id, help text, node count) instead of leaving
 *    them buried in the `display-case check` CLI log. Its header carries a
 *    show/hide toggle and stays pinned while the list scrolls; it sits below the
 *    Tweaks panel (the audit is the consequence of the tweaked state).
 *
 * Wiring `useShell` to feed live audit results into this same `a11y` field is the
 * follow-up; the chrome that renders them is what this page proves.
 */
export default defineCases(
  'A11y page',
  {
    Default: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'input', 'default'),
          a11y: mockA11y(),
          boxW: 260,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Input placeholder="Email address" aria-label="Email address" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // The panel's ⟳ re-scan control — click it to force a fresh audit (flips to
    // "Scanning…", then resolves). Mirrors useShell.rescanA11y in the live app.
    'Re-scan': () => <RescanDemo />,
    // A11y configured, but the active variant's scan is still in flight: the
    // panel shows its calm "Scanning…" state (neutral accent, no toggle) and no
    // nav markers have landed yet.
    Scanning: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'input', 'default'),
          a11y: mockA11yPending(),
          boxW: 260,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Input placeholder="Email address" aria-label="Email address" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // A11y configured and everything is clean: no nav markers, and the panel
    // shows its reassuring all-green pass state.
    'All clear': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'input', 'default'),
          a11y: mockA11yClean(),
          boxW: 260,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Input placeholder="Email address" aria-label="Email address" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // A11y NOT configured (no `a11y` on the model): no nav markers and no panel
    // at all — the chrome is exactly as it was before the feature.
    'Not configured': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'input', 'default'),
          boxW: 260,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Input placeholder="Email address" aria-label="Email address" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // A selected single-case leaf: RenderAddress has one variant, so it renders
    // as a leaf (no chevron, no case rows). With no children to defer to, its
    // lone variant's count sits directly on the (selected, marigold) leaf row —
    // never a dot. The Accessibility panel lists that variant's violations.
    'Single-case leaf': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'render-address', 'default'),
          a11y: mockA11yLeaf(),
          boxW: 360,
          boxH: 64,
        })}
        renderFrame={
          <StageSlot>
            <RenderAddress url="https://display-case.dev/render/render-address/default?theme=light" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // The per-variant nav breakdown: `button` is expanded, so its parent row
    // shows a plain dot while its three variants carry their own counts
    // (Playground 2, Variants 5, Sizes clean). The other components stay
    // collapsed, showing their summed counts — the contrast the rail draws.
    'Per-variant breakdown': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'variants'),
          a11y: mockA11yPerVariant(),
          boxW: 280,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Button variant="ghost">Low-contrast label</Button>
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // A case with more violations than the panel's height cap, so the list
    // scrolls internally while the "ACCESSIBILITY" header stays pinned. Use the
    // header's toggle to collapse the (long) list.
    Scrolling: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'input', 'default'),
          a11y: mockA11yScrolling(),
          boxW: 260,
          boxH: 96,
        })}
        renderFrame={
          <StageSlot>
            <Input placeholder="Email address" aria-label="Email address" />
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
    // Everything open at once — stage + tweaks panel + a11y panel + docs panel —
    // to see how the surfaces coexist on a crowded page. The Button atom (which
    // has a placard-doc and a tweakable Playground) is selected, so the chosen nav
    // row genuinely carries violations. The docked tweaks panel can be collapsed
    // (its header chevron) to give the content column back to the stage.
    'With tweaks and docs': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'playground'),
          a11y: mockA11y(),
          docOpen: true,
          docText: PLACEHOLDER_DOC,
          boxW: 240,
          boxH: 120,
        })}
        renderFrame={
          <StageSlot>
            <Button>Save changes</Button>
          </StageSlot>
        }
        primerFrame={null}
      />
    ),
  },
  { level: 'page' },
)
