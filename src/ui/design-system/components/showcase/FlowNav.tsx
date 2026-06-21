import type { ReactNode } from 'react'
import { Button } from '../controls/Button'
import { injectStyle } from '../inject-style'
import { Chip } from './Chip'

/**
 * Display Case — FlowNav
 * The stepper for multi-step flows: numbered step chips + Prev / Next, grouped
 * on one bar. Each step is individually addressable (click a chip), mirroring
 * the flow's `goto` transitions.
 */

const CSS = `
.dcui-flownav {
  display: flex;
  align-items: center;
  gap: var(--dc-space-6);
  flex-wrap: wrap;
  padding: var(--dc-space-4) var(--dc-space-6);
  border: 1px solid var(--dc-border);
  border-radius: var(--dc-radius-md);
  background: var(--dc-bg-subtle);
}
/* Scope the steps reset under .dcui-flownav so the no-margin/no-padding list
   wins over ambient prose styles (e.g. a Primer's .dc-primer ol rule), which
   would otherwise add a bottom margin that pushes the chips off the bar's
   centre line, out of vertical alignment with the Prev / Next rail. */
.dcui-flownav .dcui-flownav-steps {
  display: flex;
  align-items: center;
  gap: var(--dc-space-3);
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
}
.dcui-flownav-rail {
  margin-left: auto;
  display: flex;
  gap: var(--dc-space-3);
}
`
injectStyle('dcui-flownav', CSS)

export interface FlowStep {
  id: string
  label: ReactNode
}

export interface FlowNavProps {
  steps: FlowStep[]
  activeId: string
  onSelect?: (id: string) => void
}

export function FlowNav({ steps, activeId, onSelect }: FlowNavProps) {
  const idx = steps.findIndex((s) => s.id === activeId)
  const prev = steps[idx - 1]
  const next = steps[idx + 1]
  return (
    <div className="dcui-flownav">
      <ol className="dcui-flownav-steps">
        {steps.map((s, i) => (
          <li key={s.id}>
            <Chip
              index={i + 1}
              current={s.id === activeId}
              onClick={() => onSelect?.(s.id)}>
              {s.label}
            </Chip>
          </li>
        ))}
      </ol>
      <div className="dcui-flownav-rail">
        <Button
          size="sm"
          variant="subtle"
          disabled={!prev}
          onClick={() => prev && onSelect?.(prev.id)}>
          ← Prev
        </Button>
        <Button
          size="sm"
          disabled={!next}
          onClick={() => next && onSelect?.(next.id)}>
          Next →
        </Button>
      </div>
    </div>
  )
}
