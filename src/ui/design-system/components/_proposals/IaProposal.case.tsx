import { defineCases } from '@awarebydefault/display-case'
import type { ReactNode } from 'react'
import { Chip } from '../showcase/Chip'
import { Eyebrow } from '../showcase/Eyebrow'
import { NavItem } from '../showcase/NavItem'
import { SegmentedToggle } from '../showcase/SegmentedToggle'
import { Sidebar } from '../showcase/Sidebar'

/**
 * Wireframe prototypes for the `add-surface-information-architecture` change.
 *
 * These are NOT a shipping component — they compose the real Vitrine nav
 * primitives (Sidebar / Eyebrow / NavItem / Chip / SegmentedToggle) to show the
 * proposed three browse modes (Primer · Components · Exhibits), the Exhibits
 * information-architecture tree, the in-both-modes filter, and — for reference —
 * the rejected two-region single-rail alternative.
 * See openspec/changes/add-surface-information-architecture/.
 */

const noop = () => {}

const MODES = [
  { id: 'primer', label: 'Primer' },
  { id: 'components', label: 'Components' },
  { id: 'exhibits', label: 'Exhibits' },
]

const rail = { width: '17rem', maxHeight: '30rem' } as const
const column = {
  display: 'grid',
  gap: 'var(--dc-space-3)',
  width: '18rem',
} as const

// The three-way mode switch that replaces today's Primer | Cases toggle.
function ModeBar({ active }: { active: string }) {
  return (
    <SegmentedToggle
      label="View mode"
      options={MODES}
      value={active}
      onChange={noop}
    />
  )
}

// The sidebar filter input (mocked) — present in both Components and Exhibits.
function FilterBox({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--dc-space-2)',
        margin: 'var(--dc-space-1) var(--dc-space-1) var(--dc-space-3)',
        padding: 'var(--dc-space-2) var(--dc-space-3)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        color: 'var(--dc-fg-muted)',
        fontSize: 'var(--dc-text-sm)',
      }}>
      <span aria-hidden="true">⌕</span>
      <span>{text || 'Filter…'}</span>
    </div>
  )
}

// A hairline-led indent for child rows under a group folder.
function Indent({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginLeft: 'var(--dc-space-3)',
        paddingLeft: 'var(--dc-space-2)',
        borderLeft: '1px solid var(--dc-border)',
      }}>
      {children}
    </div>
  )
}

function RegionLabel({ children }: { children: ReactNode }) {
  return (
    <Eyebrow
      tone="strong"
      style={{
        margin: 'var(--dc-space-4) 0 var(--dc-space-2) var(--dc-space-2)',
      }}>
      {children}
    </Eyebrow>
  )
}

function LevelLabel({ children }: { children: ReactNode }) {
  return (
    <Eyebrow
      tone="muted"
      style={{
        margin: 'var(--dc-space-3) 0 var(--dc-space-1) var(--dc-space-2)',
      }}>
      {children}
    </Eyebrow>
  )
}

function Breadcrumb({ segments }: { segments: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--dc-space-2)',
        flexWrap: 'wrap',
        color: 'var(--dc-fg-muted)',
        fontSize: 'var(--dc-text-sm)',
      }}>
      {segments.map((seg, i) => {
        const last = i === segments.length - 1
        return (
          <span
            key={seg}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--dc-space-2)',
            }}>
            <Chip variant={last ? 'accent' : 'default'} current={last}>
              {seg}
            </Chip>
            {!last && <span aria-hidden="true">›</span>}
          </span>
        )
      })}
    </div>
  )
}

export default defineCases(
  'IA Proposal',
  {
    // ── BEFORE ────────────────────────────────────────────────────────────────
    // Today: one rail, grouped only by level. Pages flatten into a single flat,
    // alphabetical list — so authors prefix names ("Billing — …") just to make
    // the sort cluster related screens. This is the pain the change removes.
    Current: () => (
      <Sidebar label="Components" style={rail}>
        <LevelLabel>Pages</LevelLabel>
        <NavItem kind="component" label="Billing — Invoices" onSelect={noop} />
        <NavItem
          kind="component"
          label="Billing — Payment methods"
          onSelect={noop}
        />
        <NavItem kind="component" label="Marketing — About" onSelect={noop} />
        <NavItem kind="component" label="Marketing — Landing" onSelect={noop} />
        <NavItem kind="component" label="Marketing — Pricing" onSelect={noop} />
        <NavItem kind="component" label="Settings — Profile" onSelect={noop} />
        <NavItem kind="component" label="Settings — Team" onSelect={noop} />
        <LevelLabel>Flows</LevelLabel>
        <NavItem kind="component" label="Checkout — Pay" onSelect={noop} />
        <NavItem
          kind="component"
          label="Onboarding — Sign-up"
          onSelect={noop}
        />
        <LevelLabel>Atoms</LevelLabel>
        <NavItem
          kind="component"
          label="Button"
          count={4}
          onToggle={noop}
          onSelect={noop}
        />
        <NavItem kind="component" label="Chip" onSelect={noop} />
      </Sidebar>
    ),

    // ── AFTER: EXHIBITS MODE ───────────────────────────────────────────────────
    // The headline. The mode switch (Primer · Components · Exhibits) selects the
    // Exhibits view: pages + flows grouped by product IA, a filter at the top, and
    // a breadcrumb for the active surface. Short leaf labels — the tree carries
    // the context, no name prefixes.
    'Exhibits mode': () => (
      <div style={column}>
        <ModeBar active="exhibits" />
        <Breadcrumb segments={['Marketing', 'Pricing']} />
        <Sidebar label="Exhibits" style={rail}>
          <FilterBox text="" />
          <NavItem
            kind="component"
            label="Marketing"
            count={3}
            expanded
            onToggle={noop}
            onSelect={noop}
          />
          <Indent>
            <NavItem kind="case" label="Landing" onSelect={noop} />
            <NavItem kind="case" label="Pricing" current onSelect={noop} />
            <NavItem kind="case" label="About" onSelect={noop} />
          </Indent>
          <NavItem
            kind="component"
            label="Onboarding"
            count={2}
            expanded
            onToggle={noop}
            onSelect={noop}
          />
          <Indent>
            <NavItem kind="case" label="Sign-up flow" onSelect={noop} />
            <NavItem kind="case" label="Welcome" onSelect={noop} />
          </Indent>
          <NavItem
            kind="component"
            label="App"
            count={6}
            onToggle={noop}
            onSelect={noop}
          />
        </Sidebar>
      </div>
    ),

    // ── AFTER: COMPONENTS MODE ──────────────────────────────────────────────────
    // The other mode: the building-block kit, grouped by level exactly as today —
    // one consistent grouping logic, not interleaved with the IA tree. The filter
    // lives here too; a match in Exhibits stays reachable from the results.
    'Components mode': () => (
      <div style={column}>
        <ModeBar active="components" />
        <Sidebar label="Components" style={rail}>
          <FilterBox text="" />
          <LevelLabel>Atoms</LevelLabel>
          <NavItem
            kind="component"
            label="Button"
            count={4}
            expanded
            onToggle={noop}
            onSelect={noop}
          />
          <Indent>
            <NavItem kind="case" label="Default" onSelect={noop} />
            <NavItem kind="case" label="Variants" current onSelect={noop} />
          </Indent>
          <NavItem kind="component" label="Chip" onSelect={noop} />
          <LevelLabel>Molecules</LevelLabel>
          <NavItem kind="component" label="FlowNav" onSelect={noop} />
          <NavItem kind="component" label="NavItem" onSelect={noop} />
          <LevelLabel>Organisms</LevelLabel>
          <NavItem kind="component" label="Sidebar" onSelect={noop} />
        </Sidebar>
      </div>
    ),

    // ── AFTER: NESTED IA + FILTER ──────────────────────────────────────────────
    // The IA tree nests to arbitrary depth (App › Settings › Billing), so an app's
    // route hierarchy maps straight onto the rail. Shown filtered to "billing".
    'Nested groups': () => (
      <div style={column}>
        <ModeBar active="exhibits" />
        <Sidebar label="Exhibits" style={rail}>
          <FilterBox text="billing" />
          <Eyebrow
            tone="muted"
            style={{ margin: '0 0 var(--dc-space-1) var(--dc-space-2)' }}>
            2 matches
          </Eyebrow>
          <NavItem
            kind="component"
            label="App"
            expanded
            onToggle={noop}
            onSelect={noop}
          />
          <Indent>
            <NavItem
              kind="component"
              label="Settings"
              expanded
              onToggle={noop}
              onSelect={noop}
            />
            <Indent>
              <NavItem
                kind="component"
                label="Billing"
                count={2}
                expanded
                onToggle={noop}
                onSelect={noop}
              />
              <Indent>
                <NavItem kind="case" label="Invoices" current onSelect={noop} />
                <NavItem kind="case" label="Payment methods" onSelect={noop} />
              </Indent>
            </Indent>
          </Indent>
        </Sidebar>
      </div>
    ),

    // ── ALTERNATIVE (documented, not chosen) ───────────────────────────────────
    // The two-region single rail: Surfaces (by IA) stacked over Library (by level),
    // no mode switch. Rejected because two grouping logics interleave in one
    // scroll, but kept as a fallback in design.md.
    'Two regions (alt)': () => (
      <Sidebar label="Components" style={rail}>
        <RegionLabel>Surfaces</RegionLabel>
        <NavItem
          kind="component"
          label="Marketing"
          count={3}
          expanded
          onToggle={noop}
          onSelect={noop}
        />
        <Indent>
          <NavItem kind="case" label="Landing" onSelect={noop} />
          <NavItem kind="case" label="Pricing" current onSelect={noop} />
        </Indent>
        <NavItem
          kind="component"
          label="App"
          count={6}
          onToggle={noop}
          onSelect={noop}
        />
        <RegionLabel>Library</RegionLabel>
        <LevelLabel>Atoms</LevelLabel>
        <NavItem
          kind="component"
          label="Button"
          count={4}
          onToggle={noop}
          onSelect={noop}
        />
        <NavItem kind="component" label="Chip" onSelect={noop} />
        <LevelLabel>Molecules</LevelLabel>
        <NavItem kind="component" label="FlowNav" onSelect={noop} />
      </Sidebar>
    ),
  },
  { level: 'template' },
)
