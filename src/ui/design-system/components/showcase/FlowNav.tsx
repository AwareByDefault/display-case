import type { ReactNode } from 'react'
import { Button } from '../controls/Button'
import { Chip } from './Chip'

/**
 * Display Case — FlowNav
 * The stepper for multi-step flows: numbered step chips + Prev / Next, grouped
 * on one bar. Each step is individually addressable (click a chip), mirroring
 * the flow's `goto` transitions.
 */

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
