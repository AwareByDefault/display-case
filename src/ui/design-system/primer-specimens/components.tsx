/**
 * Components overview — the three grouped specimens for the Primer's
 * "Components" section. Each maps to one `components/` subfolder and lays its
 * members out as labelled rows (a mono tag on the left, live specimens on the
 * right):
 *
 *   · ControlsOverview — the input atoms (`components/controls/`).
 *   · ShowcaseOverview — the shell molecules & organisms (`components/showcase/`).
 *   · PrimerOverview  — the Primer-authoring primitives (`components/primer-specimen/`).
 *
 * Like the other showcase specimens, these compose the design-system components
 * directly, so they track the live theme. The labelled-row chrome
 * (`dcpl-overview` / `dcpl-ovrow` / `dcpl-ovlabel`) is defined in
 * `components/primer-specimen/styles.ts`.
 */
import { type ReactNode, useState } from 'react'
import {
  Button,
  Chip,
  Eyebrow,
  FlowNav,
  IconButton,
  Input,
  NavItem,
  RenderAddress,
  Select,
  SelectMenu,
  Sidebar,
  Stage,
  TweaksPanel,
} from '../components'
import {
  type BoxSpec,
  GlyphGrid,
  type SpaceStep,
  SpacingScale,
  SpecimenBoxRow,
  type Swatch,
  SwatchGrid,
} from '../components/primer-specimen'

/** One labelled row inside an overview: mono tag left, specimens right. */
function OverviewRow({
  label,
  align,
  children,
}: {
  label: string
  /** Top-align the tag when the row holds a tall specimen (a panel, a tree). */
  align?: 'start'
  children: ReactNode
}) {
  return (
    <div className="dcpl-ovrow" data-align={align}>
      <div className="dcpl-ovlabel">{label}</div>
      <div className="dcpl-ovitems">{children}</div>
    </div>
  )
}

/** The input atoms — `components/controls/`. */
export function ControlsOverview() {
  // SelectMenu is controlled — the row owns its committed value.
  const [device, setDevice] = useState('Desktop')
  return (
    <div className="dcpl-overview">
      <OverviewRow label="Button">
        <Button>Ghost</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="subtle">Subtle</Button>
        <Button size="sm">Small</Button>
        <Button disabled>Disabled</Button>
      </OverviewRow>
      <OverviewRow label="Icon">
        <IconButton glyph="☰" label="Nav" />
        <IconButton glyph="⟲" label="Rotate" />
        <IconButton glyph="✕" label="Close" active />
        <IconButton glyph="＋" label="Zoom in" variant="bare" />
        <IconButton glyph="－" label="Zoom out" variant="bare" />
      </OverviewRow>
      <OverviewRow label="Input">
        <Input placeholder="Search cases…" style={{ width: '11rem' }} />
        <Input
          type="number"
          defaultValue={1280}
          suffix="px"
          style={{ width: '6rem' }}
        />
        <Input placeholder="t. opacity" style={{ width: '8rem' }} />
      </OverviewRow>
      <OverviewRow label="Select">
        <Select
          defaultValue="Full"
          options={[
            { label: 'Responsive', options: ['Full', 'Desktop', 'Mobile'] },
            { label: 'Devices', options: ['1080p', 'iPhone 15'] },
          ]}
        />
        <Select size="sm" options={['light', 'dark']} />
        <SelectMenu
          aria-label="Device"
          options={['Desktop', 'Tablet', 'Mobile']}
          value={device}
          onChange={setDevice}
        />
      </OverviewRow>
    </div>
  )
}

const FLOW_STEPS = [
  { id: 'Request link', label: 'Request link' },
  { id: 'Check email', label: 'Check email' },
  { id: 'Signed in', label: 'Signed in' },
]

const TWEAK_ITEMS = [
  {
    label: 'label',
    control: <Input size="sm" defaultValue="Save" style={{ width: '8rem' }} />,
  },
  {
    label: 'kind',
    control: <Select size="sm" options={['choice', 'text']} />,
  },
  {
    label: 'disabled',
    control: <input type="checkbox" aria-label="disabled" defaultChecked />,
  },
]

const FLOAT_ITEMS = [
  { label: 'kind', control: <Select size="sm" options={['choice', 'text']} /> },
  {
    label: 'disabled',
    control: <input type="checkbox" aria-label="disabled" />,
  },
]

/** A labelled showcase section — a mono label sitting above its specimen. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="dcpl-sc-block">
      <div className="dcpl-ovlabel">{label}</div>
      {children}
    </section>
  )
}

/** The shell molecules & organisms — `components/showcase/`. */
export function ShowcaseOverview() {
  const [active, setActive] = useState('Check email')
  return (
    <div className="dcpl-sc">
      <div className="dcpl-sc-cols" data-pair="">
        <div className="dcpl-sc-stack">
          <Section label="Sidebar / NavItem">
            <Sidebar style={{ width: '15rem' }}>
              <NavItem
                kind="component"
                label="Button"
                count={4}
                current
                expanded
                onToggle={() => {}}
                onSelect={() => {}}
              />
              <NavItem
                kind="case"
                label="Playground"
                current
                onSelect={() => {}}
              />
              <NavItem kind="case" label="Disabled" onSelect={() => {}} />
              <NavItem
                kind="component"
                label="Stage"
                count={3}
                onToggle={() => {}}
                onSelect={() => {}}
              />
            </Sidebar>
          </Section>
          <Section label="Eyebrow">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}>
              <Eyebrow>Components</Eyebrow>
              <Eyebrow tone="strong">Documentation</Eyebrow>
              <Eyebrow tone="accent">Tweaks</Eyebrow>
            </div>
          </Section>
        </div>
        <Section label="Stage">
          <Stage
            caption="Playground"
            meta="390 × 844"
            frame="fill"
            grid
            corners
            style={{ width: '100%', flex: 1, minHeight: 0 }}>
            <Chip variant="accent">exhibit goes here</Chip>
          </Stage>
        </Section>
      </div>
      <Section label="Chip">
        <div className="dcpl-ovitems">
          <Chip>atom</Chip>
          <Chip>molecule</Chip>
          <Chip variant="accent">flow</Chip>
          <Chip variant="solid">page</Chip>
          <Chip current index="2">
            Check email
          </Chip>
        </div>
      </Section>
      <Section label="FlowNav">
        <FlowNav steps={FLOW_STEPS} activeId={active} onSelect={setActive} />
      </Section>
      <Section label="TweaksPanel — docked / floating">
        <div className="dcpl-sc-tweaks">
          <TweaksPanel
            url="?t.kind=choice&t.disabled=1"
            items={TWEAK_ITEMS}
            onToggleMode={() => {}}
          />
          <div className="dcpl-sc-float">
            {'tall exhibit — pan & zoom'}
            <TweaksPanel
              mode="floating"
              url="?t.kind=choice"
              items={FLOAT_ITEMS}
              onToggleMode={() => {}}
            />
          </div>
        </div>
      </Section>
      <Section label="RenderAddress">
        <RenderAddress url="/render/button/playground?theme=light&t.variant=accent" />
      </Section>
    </div>
  )
}

const SWATCHES: Swatch[] = [
  { token: 'brand', color: 'var(--dc-brand)', role: 'accent' },
  { token: 'fg', color: 'var(--dc-fg)', role: 'text' },
  { token: 'surface', color: 'var(--dc-surface)', role: 'inputs' },
  { token: 'border', color: 'var(--dc-border)', role: 'hairline' },
]

const SPACE: SpaceStep[] = [
  { token: 'space-2', value: '4px', width: 4 },
  { token: 'space-4', value: '8px', width: 8 },
  { token: 'space-8', value: '16px', width: 16 },
  { token: 'space-16', value: '32px', width: 32 },
]

const GLYPHS = [
  { glyph: '☰', use: 'nav' },
  { glyph: '⟲', use: 'reset' },
  { glyph: '✕', use: 'close' },
  { glyph: '＋', use: 'zoom in' },
  { glyph: '－', use: 'zoom out' },
]

const RADII: BoxSpec[] = [
  {
    label: 'sm',
    note: '5px · controls',
    boxStyle: { borderRadius: 'var(--dc-radius-sm)' },
  },
  {
    label: 'md',
    note: '8px · panels',
    boxStyle: { borderRadius: 'var(--dc-radius-md)' },
  },
  {
    label: 'full',
    note: 'pills · dots',
    boxStyle: { borderRadius: 'var(--dc-radius-full)', width: '48px' },
  },
]

/** The Primer-authoring primitives — `components/primer-specimen/`. */
export function PrimerOverview() {
  return (
    <div className="dcpl-overview">
      <OverviewRow label="Swatches" align="start">
        <SwatchGrid swatches={SWATCHES} columns={4} />
      </OverviewRow>
      <OverviewRow label="Spacing" align="start">
        <SpacingScale steps={SPACE} />
      </OverviewRow>
      <OverviewRow label="Glyphs" align="start">
        <GlyphGrid glyphs={GLYPHS} columns={5} />
      </OverviewRow>
      <OverviewRow label="Boxes" align="start">
        <SpecimenBoxRow items={RADII} />
      </OverviewRow>
    </div>
  )
}
