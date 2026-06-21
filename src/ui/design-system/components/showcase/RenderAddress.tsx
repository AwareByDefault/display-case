import { useState } from 'react'
import { IconButton } from '../controls/IconButton'

/**
 * Display Case — RenderAddress
 * A monospace address bar: an HTTP method tag, a URL that truncates with an
 * ellipsis if it overflows, and a copy button. Shows a deterministic render URL (or any
 * endpoint) the reader can copy — the browse chrome uses it for the live
 * exhibit's address.
 */

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
