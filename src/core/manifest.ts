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
  /** Resolved information-architecture group path (Exhibits mode); `[]` for
   *  building-block components and surfaces in the default group. */
  group: string[]
  /** Repo-relative path to the case file. */
  caseFile: string
  /** Repo-relative path to the authored usage doc, or null. */
  placardDoc: string | null
  /** For a flow these are its ordered, transitionable steps. */
  cases: ManifestCase[]
}

/** One node of the Exhibits-mode information-architecture group tree. */
export interface ManifestGroup {
  /** Display label for this group segment (config override or the segment). */
  label: string
  /** Full resolved path to this group (display segments). */
  path: string[]
  /** Collapsed by default on first load. */
  collapsed: boolean
  /** Nested child groups. */
  children: ManifestGroup[]
}

/** A top-level browse mode. `components` lists the building-block kit by level;
 *  `exhibits` lists page/flow surfaces by their information-architecture group;
 *  `primer` is the optional long-form reading page. */
export type BrowseMode = 'primer' | 'components' | 'exhibits'

export interface Manifest {
  title: string
  components: ManifestComponent[]
  /** The Exhibits-mode information-architecture group tree, ordered. Surfaces in
   *  the default group contribute no node; `[]` when there are no grouped surfaces. */
  groups: ManifestGroup[]
  /** Browse modes that have content, in canonical order (primer, components,
   *  exhibits). A mode absent here is never offered; the switch shows only when
   *  two or more are present. */
  modes: BrowseMode[]
  /** The mode the chrome lands on at `/` — the configured landing when present,
   *  else the first present mode. Always one of `modes`. A deep-linked case opens
   *  that case regardless. */
  landing: BrowseMode
  /** How flows are distinguished from pages in the Exhibits sidebar: a leading
   *  glyph (default) or a trailing `flow` tag. Resolved from `nav.flowMarker`. */
  flowMarker?: 'glyph' | 'tag'
}
