import { defineCases, tweak } from '@awarebydefault/display-case'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useState,
} from 'react'
import { Eyebrow } from './Eyebrow'
import { NavItem } from './NavItem'
import { Sidebar } from './Sidebar'

// Self-contained resize demo: the same `resize` handle the chrome uses, driven
// by local state so the rail can be dragged (or arrow-keyed) right here in the
// Stage. Drag the right edge between 240–480px. The live chrome additionally
// remembers the width across sessions (see use-shell).
const MIN_W = 240
const MAX_W = 480
function ResizableDemo() {
  const [w, setW] = useState(MIN_W)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const x0 = e.clientX
    const w0 = w
    const move = (ev: PointerEvent) =>
      setW(Math.max(MIN_W, Math.min(MAX_W, w0 + (ev.clientX - x0))))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let step = 0
    if (e.key === 'ArrowRight') step = 16
    else if (e.key === 'ArrowLeft') step = -16
    if (!step) return
    e.preventDefault()
    setW((v) => Math.max(MIN_W, Math.min(MAX_W, v + step)))
  }
  return (
    <Sidebar
      style={{ width: `${w}px`, maxHeight: '24rem' }}
      resize={{
        onPointerDown,
        onKeyDown,
        valueNow: w,
        valueMin: MIN_W,
        valueMax: MAX_W,
      }}>
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
      <NavItem
        kind="component"
        label="Checkbox"
        onToggle={() => {}}
        onSelect={() => {}}
      />
    </Sidebar>
  )
}

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
    // Drag the rail's right edge (or focus it and use ←/→) to resize, 240–480px.
    Resizable: () => <ResizableDemo />,
  },
  { level: 'organism' },
)
