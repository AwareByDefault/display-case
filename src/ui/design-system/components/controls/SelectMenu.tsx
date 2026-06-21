import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Display Case — SelectMenu
 * An accessible custom single-select, built to the WAI-ARIA "select-only
 * combobox" pattern: a `role="combobox"` trigger that owns a popup
 * `role="listbox"` of `role="option"`s, with focus kept on the trigger and the
 * active option tracked via `aria-activedescendant`. Screen readers announce and
 * operate it like a native `<select>`, but it commits on click with no OS popup
 * menu — so the bound value updates *instantly* (a native `<select>` on macOS
 * defers its `change` event until the native menu finishes dismissing, which
 * reads as a lag when the bound view updates live).
 *
 * Keyboard: ↑/↓ move the active option, Home/End jump to the ends, type-ahead
 * matches by label, Enter/Space commit, Esc closes without change, Tab commits
 * then moves on. The popup portals to `document.body` so an `overflow`-clipping
 * or `position: fixed` ancestor can't trap it.
 */

export type SelectMenuSize = 'sm' | 'md'
export type SelectMenuOption =
  | string
  /** A non-interactive option renders as a quiet group header — not selectable,
   *  skipped by keyboard nav and type-ahead. */
  | { value: string; label?: ReactNode; disabled?: boolean }

export interface SelectMenuProps {
  options: SelectMenuOption[]
  value: string
  onChange: (value: string) => void
  size?: SelectMenuSize
  disabled?: boolean
  'aria-label'?: string
  id?: string
}

interface NormOption {
  value: string
  label: ReactNode
  /** Lowercased text used for type-ahead matching. */
  text: string
  /** A header row: rendered, but not selectable / navigable / matchable. */
  disabled: boolean
}

function normalize(options: SelectMenuOption[]): NormOption[] {
  return options.map((o) => {
    if (typeof o === 'string')
      return { value: o, label: o, text: o.toLowerCase(), disabled: false }
    const text = typeof o.label === 'string' ? o.label : o.value
    return {
      value: o.value,
      label: o.label ?? o.value,
      text: text.toLowerCase(),
      disabled: !!o.disabled,
    }
  })
}

/** Next option (by index, wrapping) whose label starts with the typed buffer.
 *  Disabled headers are skipped. */
function findMatch(opts: NormOption[], buffer: string, from: number): number {
  const n = opts.length
  if (n === 0) return -1
  // A single character cycles forward (skip the current match); a longer buffer
  // may need to land on the current option, so start inclusive.
  const startK = buffer.length === 1 ? 1 : 0
  for (let k = startK; k <= n; k++) {
    const i = (from + k) % n
    if (!opts[i].disabled && opts[i].text.startsWith(buffer)) return i
  }
  return -1
}

/** First selectable index, or 0 if none. */
function firstEnabled(opts: NormOption[]): number {
  const i = opts.findIndex((o) => !o.disabled)
  return i < 0 ? 0 : i
}

/** Last selectable index, or `opts.length - 1` if none. */
function lastEnabled(opts: NormOption[]): number {
  for (let i = opts.length - 1; i >= 0; i--) if (!opts[i].disabled) return i
  return opts.length - 1
}

/** Nearest selectable index strictly past `from` in `dir` (+1/-1); stays put if
 *  there is none, so a header can never become the active row. */
function moveEnabled(opts: NormOption[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < opts.length; i += dir) {
    if (!opts[i].disabled) return i
  }
  return from
}

interface Coords {
  left: number
  top: number
  minWidth: number
  maxHeight: number
  placement: 'down' | 'up'
}

export function SelectMenu({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
  id,
}: SelectMenuProps) {
  const opts = normalize(options)
  const reactId = useId()
  const baseId = id ?? reactId
  const listboxId = `${baseId}-listbox`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const rawSelected = opts.findIndex((o) => o.value === value)
  const selectedIndex = rawSelected >= 0 ? rawSelected : firstEnabled(opts)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const [coords, setCoords] = useState<Coords | null>(null)

  const triggerRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef(activeIndex)
  activeRef.current = activeIndex
  // Type-ahead buffer + its reset timer.
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openAt = (index: number) => {
    setActiveIndex(index)
    setOpen(true)
  }
  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }
  const commit = (index: number) => {
    const opt = opts[index]
    if (!opt || opt.disabled) return // headers aren't selectable
    if (opt.value !== value) onChange(opt.value)
    close()
  }

  const typeahead = (char: string) => {
    bufferRef.current += char.toLowerCase()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      bufferRef.current = ''
    }, 500)
    const match = findMatch(opts, bufferRef.current, activeRef.current)
    if (match >= 0) setActiveIndex(match)
  }

  // Position the portaled popup against the trigger, flipping above when there
  // isn't room below. Measured before paint so it never flashes mispositioned.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const margin = 8
    const spaceBelow = window.innerHeight - r.bottom - margin
    const spaceAbove = r.top - margin
    const up = spaceBelow < 160 && spaceAbove > spaceBelow
    setCoords({
      left: r.left,
      top: up ? r.top : r.bottom,
      minWidth: r.width,
      maxHeight: Math.max(96, up ? spaceAbove : spaceBelow),
      placement: up ? 'up' : 'down',
    })
  }, [open])

  // Keep the active option scrolled into view as it moves. `optionId` is a
  // stable id formatter (baseId is fixed for the component's life).
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionId is stable; open/activeIndex drive the effect
  useEffect(() => {
    if (!open) return
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  // While open, dismiss on an outside press or on any ancestor scroll/resize
  // (the popup is fixed-positioned, so a scroll would otherwise strand it).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t))
        return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      // Ignore the popup's own internal scroll.
      if (e.target instanceof Node && listRef.current?.contains(e.target))
        return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // Drop a stale type-ahead timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const isPrintable = (e: ReactKeyboardEvent) =>
    e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!open) {
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
        case 'Spacebar':
          e.preventDefault()
          openAt(selectedIndex)
          return
        case 'Home':
          e.preventDefault()
          openAt(firstEnabled(opts))
          return
        case 'End':
          e.preventDefault()
          openAt(lastEnabled(opts))
          return
        default:
          if (isPrintable(e)) {
            e.preventDefault()
            setOpen(true)
            typeahead(e.key)
          }
          return
      }
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => moveEnabled(opts, i, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => moveEnabled(opts, i, -1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(firstEnabled(opts))
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(lastEnabled(opts))
        break
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        // Commit the active option, then let focus move on naturally.
        commit(activeIndex)
        break
      default:
        if (isPrintable(e)) {
          e.preventDefault()
          typeahead(e.key)
        }
    }
  }

  const onTriggerClick = () => {
    if (disabled) return
    if (open) setOpen(false)
    else openAt(selectedIndex)
  }

  const selected = opts[selectedIndex]

  return (
    <span className="dcui-selectmenu dcui-select" data-size={size}>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        className="dcui-select-el dcui-selectmenu-trigger"
        onClick={onTriggerClick}
        onKeyDown={onKeyDown}>
        <span className="dcui-selectmenu-value">
          {selected?.label ?? value}
        </span>
      </div>
      <span className="dcui-select-caret" aria-hidden="true">
        ▾
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="dcui-selectmenu-list"
            data-size={size}
            style={{
              left: coords.left,
              minWidth: coords.minWidth,
              maxHeight: coords.maxHeight,
              ...(coords.placement === 'up'
                ? { top: coords.top, transform: 'translateY(-100%)' }
                : { top: coords.top }),
            }}>
            {opts.map((o, i) => {
              const isSelected = !o.disabled && o.value === value
              return (
                // Options are pointer affordances only: focus stays on the
                // combobox trigger (aria-activedescendant) and all keyboard
                // handling lives there, so these two rules don't apply here.
                // biome-ignore lint/a11y/useFocusableInteractive: combobox keeps focus; option is tracked via aria-activedescendant
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled on the combobox trigger, not per-option
                <div
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  data-active={!o.disabled && i === activeIndex}
                  className="dcui-selectmenu-option"
                  onMouseEnter={
                    o.disabled ? undefined : () => setActiveIndex(i)
                  }
                  // Keep focus on the combobox trigger (the menu commits on click).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={o.disabled ? undefined : () => commit(i)}>
                  <span className="dcui-selectmenu-check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                  {o.label}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </span>
  )
}
