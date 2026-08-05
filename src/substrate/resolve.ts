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

/** The resolved substrate, narrowed when it is the built-in DOM one. */
export function asDomSubstrate(substrate: Substrate): DomSubstrate | undefined {
  return substrate.id === 'dom' ? (substrate as DomSubstrate) : undefined
}
