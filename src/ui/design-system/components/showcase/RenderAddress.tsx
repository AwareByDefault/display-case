import { useState } from 'react'
import { IconButton } from '../controls/IconButton'
import { injectStyle } from '../inject-style'

/**
 * Display Case — RenderAddress
 * A monospace address bar: an HTTP method tag, a URL that truncates with an
 * ellipsis if it overflows, and a copy button. Shows a deterministic render URL (or any
 * endpoint) the reader can copy — the browse chrome uses it for the live
 * exhibit's address.
 */

const CSS = `
.dcui-address {
  display: flex; align-items: center; gap: var(--dc-space-4); width: 100%;
  /* border-box so the 100% width + padding + border stays inside the container
     (matches the docked tweaks panel's right edge instead of overflowing it). */
  box-sizing: border-box;
  border: var(--dc-border-line); border-radius: var(--dc-radius-sm);
  background: var(--dc-surface); padding: var(--dc-space-3) var(--dc-space-4);
}
/* A solid accent tag (the accent Button's fill), but inert — it's just a label. */
.dcui-address-method {
  flex: 0 0 auto; line-height: 1;
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium);
  color: var(--dc-brand-fg); background: var(--dc-brand);
  padding: 0.3125rem var(--dc-space-3); border-radius: var(--dc-radius-sm);
}
.dcui-address-url {
  font-family: var(--dc-font-mono); font-size: var(--dc-text-sm);
  color: var(--dc-fg); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
`
injectStyle('dcui-address', CSS)

export interface RenderAddressProps {
  /** The address shown and copied. */
  url: string
  /** HTTP method tag on the left. */
  method?: string
}

export function RenderAddress({ url, method = 'GET' }: RenderAddressProps) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try {
      navigator.clipboard?.writeText(url)
    } catch {
      // Clipboard may be unavailable in an isolated frame — the address still reads.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="dcui-address">
      <span className="dcui-address-method">{method}</span>
      <span className="dcui-address-url">{url}</span>
      <IconButton
        glyph={copied ? '✓' : '⧉'}
        label="Copy address"
        variant="bare"
        size="sm"
        onClick={copy}
      />
    </div>
  )
}
