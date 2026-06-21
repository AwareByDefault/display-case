import type { HierarchyLevel, TweakSchema } from '../index'

/** Type-only manifest contract shared by the server (builder) and the shell. */

export interface ManifestCase {
  id: string
  name: string
  /** In-app browse address, e.g. /c/button/default. */
  browseUrl: string
  /** Isolated render address, e.g. /render/button/default. */
  renderUrl: string
  /** Declared tweak schema, or null when the case takes no tweaks. */
  tweaks: TweakSchema | null
  /** Slugified ids of steps this step can transition to (flows only; else []). */
  transitions: string[]
}

export interface ManifestComponent {
  id: string
  name: string
  level: HierarchyLevel | null
  isFlow: boolean
  /** Repo-relative path to the case file. */
  caseFile: string
  /** Repo-relative path to the authored usage doc, or null. */
  placardDoc: string | null
  /** For a flow these are its ordered, transitionable steps. */
  cases: ManifestCase[]
}

export interface Manifest {
  title: string
  components: ManifestComponent[]
  /** True when a Primer (`.mdx` reading page) is configured and present. The
   *  chrome shows the Primer / Cases mode switch only then. */
  primer: boolean
  /** The view the chrome lands on at `/`: `'primer'` only when a Primer is
   *  configured and the config didn't override the landing to `'cases'`; else
   *  `'library'`. A deep-linked case always opens the library. */
  landing: 'primer' | 'library'
}
