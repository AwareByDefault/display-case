import { defineCases } from '@awarebydefault/display-case'
import { A11yBadge } from './A11yBadge'
import { NavItem } from './NavItem'
import { Sidebar } from './Sidebar'

export default defineCases(
  'A11yBadge',
  {
    // The two forms: a counted pill and the bare dot.
    Forms: () => (
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <A11yBadge value={1} />
        <A11yBadge value={3} />
        <A11yBadge value={12} />
        <A11yBadge value="dot" />
      </div>
    ),
    // In context: a collapsed component shows its summed count; an expanded
    // parent shows the dot while its case rows carry the per-variant counts.
    'In the nav rail': () => (
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
  },
  { level: 'atom' },
)
