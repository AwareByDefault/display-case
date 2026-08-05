import type { Substrate } from '../core/substrate'
import type { DisplayCaseConfig } from '../index'
import { type DomSubstrate, domSubstrate } from './dom'

/**
 * Resolve the substrate a showcase renders through.
 *
 * A showcase that configures none gets the DOM substrate — the default that
 * makes this whole seam a no-op for every existing consumer. The DOM-shaped
 * options that predate the substrate key are routed into it here, so they keep
 * working exactly as before rather than being silently ignored:
 *
 * - `providers.driver` — the deprecated snapshot-driver override. It is public
 *   API, so it is still accepted and forwarded into `domSubstrate({ driver })`
 *   rather than removed. `providers.diff` is *not* routed here: it stays a
 *   top-level consumer override that wins over whatever the substrate supplies,
 *   because a diff is substrate-neutral (bytes in, changed-or-not out) and a
 *   consumer may legitimately want to override it on its own.
 *
 * A showcase that *does* configure a substrate gets exactly that object; its
 * own factory options are its business, and Display Case does not second-guess
 * them.
 */
export function resolveSubstrate(config: DisplayCaseConfig): Substrate {
  if (config.substrate) return config.substrate as Substrate
  return domSubstrate({ driver: config.providers?.driver })
}

/**
 * Read a value for every `render`-kind axis the substrate declares from an
 * address, falling back to each axis's declared default.
 *
 * The address vocabulary belongs to the substrate, not to Display Case: for the
 * DOM substrate this reads `?theme=`, exactly as it always did, while a
 * substrate for another medium declares its own axes and has them honored here
 * without this code knowing their names. A value the axis does not declare
 * falls back to the default, so a hand-edited address can never select an
 * undeclared variant — and both hosts decode addresses identically, which is
 * what keeps a deep link reproducible across dev and a published build.
 */
export function renderVariants(
  params: URLSearchParams,
  substrate: Substrate,
): Record<string, string> {
  const variants: Record<string, string> = {}
  for (const axis of substrate.variants) {
    if (axis.kind !== 'render') continue
    const raw = params.get(axis.id)
    const declared = raw !== null && axis.values.some((v) => v.value === raw)
    variants[axis.id] = declared ? raw : axis.default
  }
  return variants
}

/** The resolved substrate, narrowed when it is the built-in DOM one. */
export function asDomSubstrate(substrate: Substrate): DomSubstrate | undefined {
  return substrate.id === 'dom' ? (substrate as DomSubstrate) : undefined
}
