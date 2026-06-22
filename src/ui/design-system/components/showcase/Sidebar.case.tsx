import { defineCases, tweak } from '@awarebydefault/display-case'
import { Eyebrow } from './Eyebrow'
import { NavItem } from './NavItem'
import { Sidebar } from './Sidebar'

export default defineCases(
  'Sidebar',
  {
    Playground: {
      tweaks: {
        label: tweak.text('Components'),
        width: tweak.number(15),
        maxHeight: tweak.number(24),
        showEyebrow: tweak.boolean(true),
      },
      render: (t) => (
        <Sidebar
          label={t.label}
          style={{ width: `${t.width}rem`, maxHeight: `${t.maxHeight}rem` }}>
          {t.showEyebrow && (
            <Eyebrow style={{ margin: '0 0 0.5rem 0.5rem' }}>Atoms</Eyebrow>
          )}
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
    },
    Tree: () => (
      <Sidebar style={{ width: '15rem', maxHeight: '24rem' }}>
        <Eyebrow style={{ margin: '0 0 0.5rem 0.5rem' }}>Atoms</Eyebrow>
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
  },
  { level: 'organism' },
)
