import { defineCases } from '@awarebydefault/display-case'
import { Button } from '..'
import { ShellView } from './ShellView'
import {
  FlowStep,
  makeModel,
  mockManifest,
  PageScreen,
  PLACEHOLDER_DOC,
  StageSlot,
  selectIn,
} from './shell-fixtures'

/**
 * A real page: the Cases chrome (the library view) browsing the mock manifest,
 * with a live exhibit on the stage. The variants pour the same page full to
 * different depths and show how the stage adapts to what it's browsing:
 *
 * - **Default / With tweaks / With docs / With tweaks and docs** — browsing the
 *   Button atom; the tweaks panel rides alongside when the case carries a
 *   schema, the docs panel opens when the component has a placard-doc.
 * - **Page** — browsing a page-level component, where the stage drops its grid
 *   and padding to let the screen fill edge to edge.
 * - **Flow** — browsing a flow, where the FlowNav stepper appears above the
 *   stage and it fills edge to edge.
 *
 * The Primer reading view is its own page — see Primer page.
 */

// The Variants case content — the stage for the bare/docs exhibits, which select
// the schema-less "Variants" case.
const variantsExhibit = (
  <StageSlot>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Button>Save changes</Button>
      <Button variant="accent">Publish</Button>
      <Button variant="ghost">Cancel</Button>
    </div>
  </StageSlot>
)

// The Playground case's stage at its default tweak values (variant 'ghost', size
// 'md', label 'Button') — the single button the tweaks panel's controls drive.
// The exhibits that select "Playground" put this on the stage, so the controls
// and the staged button agree.
const playgroundExhibit = (
  <StageSlot>
    <Button>Button</Button>
  </StageSlot>
)

export default defineCases(
  'Cases page',
  {
    // The bare stage: the Variants case has no tweak schema and docs stay closed.
    Default: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'variants'),
          boxW: 280,
          boxH: 120,
        })}
        renderFrame={variantsExhibit}
        primerFrame={null}
      />
    ),
    // Tweaks revealed: the Playground case carries a tweak schema, so the docked
    // TweaksPanel rides alongside the stage — its controls at their defaults,
    // driving the Playground button on the stage.
    'With tweaks': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'playground'),
          boxW: 280,
          boxH: 120,
        })}
        renderFrame={playgroundExhibit}
        primerFrame={null}
      />
    ),
    // Documentation revealed: the Button component has a placard-doc, so opening
    // the docs panel pours real prose into the aside.
    'With docs': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'variants'),
          docOpen: true,
          docText: PLACEHOLDER_DOC,
          boxW: 280,
          boxH: 120,
        })}
        renderFrame={variantsExhibit}
        primerFrame={null}
      />
    ),
    // The page at its fullest: the Playground case's tweaks panel and the open
    // docs panel flank the Playground button on the stage.
    'With tweaks and docs': () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'button', 'playground'),
          docOpen: true,
          docText: PLACEHOLDER_DOC,
          boxW: 280,
          boxH: 120,
        })}
        renderFrame={playgroundExhibit}
        primerFrame={null}
      />
    ),
    // Browsing a page: a page-level component flips `stageDecor` off, so the
    // stage drops its grid, corner ticks, and padding (and the header's Grid
    // button), and `fillFrame` lets the screen fill the whole stage edge to edge
    // rather than sitting in a centred box.
    Page: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'cases-page', 'default'),
          stageDecor: false,
        })}
        fillFrame
        renderFrame={<PageScreen />}
        primerFrame={null}
      />
    ),
    // Browsing a flow: a flow component shows the FlowNav stepper above the stage
    // (one tab per step) and, like a page, fills the whole stage edge to edge.
    Flow: () => (
      <ShellView
        {...makeModel({
          ...selectIn(mockManifest, 'sign-in', 'request-link'),
          stageDecor: false,
        })}
        fillFrame
        renderFrame={<FlowStep />}
        primerFrame={null}
      />
    ),
  },
  { level: 'page' },
)
