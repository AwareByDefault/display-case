import { defineCases, tweak } from '@awarebydefault/display-case'
import { NavItem } from './NavItem'
import { Sidebar } from './Sidebar'

export default defineCases(
  'NavItem',
  {
    // Wrapped in Sidebar — NavItem rows are transparent and only read correctly
    // against the sidebar's `--dc-bg-subtle` surface.
    Playground: {
      tweaks: {
        kind: tweak.choice(['component', 'case'], 'component'),
        label: tweak.text('Button'),
        withCount: tweak.boolean(true),
        count: tweak.number(4),
        alert: tweak.number(0),
        current: tweak.boolean(false),
        expanded: tweak.boolean(false),
      },
      render: (t) => (
        <Sidebar style={{ width: '15rem' }}>
          <NavItem
            kind={t.kind as 'component' | 'case'}
            label={t.label}
            count={t.withCount ? t.count : undefined}
            alert={t.alert}
            current={t.current}
            expanded={t.expanded}
            onToggle={() => {}}
            onSelect={() => {}}
          />
        </Sidebar>
      ),
    },
    // Accessibility-violation markers. Collapsed, a component shows the summed
    // count (the danger pill). Expanded, the parent shows a plain dot while the
    // per-variant counts move onto the case rows. See the "A11y page" exhibit
    // for the markers in the full chrome.
    Alert: () => (
      <Sidebar style={{ width: '15rem' }}>
        <NavItem
          kind="component"
          label="Input"
          count={2}
          alert={5}
          onToggle={() => {}}
          onSelect={() => {}}
        />
        <NavItem
          kind="component"
          label="Button"
          count={3}
          alert="dot"
          expanded
          onToggle={() => {}}
          onSelect={() => {}}
        />
        <NavItem kind="case" label="Playground" alert={2} onSelect={() => {}} />
        <NavItem kind="case" label="Variants" alert={3} onSelect={() => {}} />
        <NavItem kind="case" label="Sizes" onSelect={() => {}} />
      </Sidebar>
    ),
    Tree: () => (
      <Sidebar style={{ width: '15rem' }}>
        <NavItem
          kind="component"
          label="Button"
          count={4}
          expanded
          onToggle={() => {}}
          onSelect={() => {}}
        />
        <NavItem kind="case" label="Playground" onSelect={() => {}} />
        <NavItem kind="case" label="Variants" current onSelect={() => {}} />
        <NavItem kind="case" label="Sizes" onSelect={() => {}} />
        <NavItem
          kind="component"
          label="Checkbox"
          onToggle={() => {}}
          onSelect={() => {}}
        />
      </Sidebar>
    ),
    // Surface markers used in the Exhibits mode: a page renders plain; a flow is
    // marked by a leading `icon` glyph (or a trailing `tag`) and its step rows
    // carry a leading `index`.
    Surfaces: () => (
      <Sidebar style={{ width: '15rem' }}>
        <NavItem
          kind="component"
          label="Pricing"
          onToggle={() => {}}
          onSelect={() => {}}
        />
        <NavItem
          kind="component"
          label="Sign-up"
          icon="⤳"
          count={3}
          expanded
          onToggle={() => {}}
          onSelect={() => {}}
        />
        <NavItem
          kind="case"
          label="Request link"
          index={1}
          onSelect={() => {}}
        />
        <NavItem
          kind="case"
          label="Check email"
          index={2}
          current
          onSelect={() => {}}
        />
        <NavItem kind="case" label="Done" index={3} onSelect={() => {}} />
        <NavItem
          kind="component"
          label="Checkout"
          tag="flow"
          onToggle={() => {}}
          onSelect={() => {}}
        />
      </Sidebar>
    ),
  },
  { level: 'molecule' },
)
