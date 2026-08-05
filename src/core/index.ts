/**
 * `@awarebydefault/display-case/core` — the substrate-neutral core.
 *
 * This is the surface a **rendering substrate** is implemented against: the
 * authoring model, case discovery, the catalog and manifest contracts, group
 * resolution, and the DOM-free construction of a case's React tree. Nothing
 * reachable from here touches a DOM, a server, a bundler, or a browser — the
 * import direction is enforced by a test (`index.test.ts`), so this stays true.
 *
 * Everything else (`server/`, `checks/`, `commands/`, `ui/`, and the built-in
 * DOM substrate) sits *above* this module and is deliberately not exported.
 *
 * The re-exports below are ordered by module specifier because the linter sorts
 * them; the grouping to read by is: the authoring model (`../index`), case-tree
 * construction (`../render/render-node`), the catalog, discovery, groups, the
 * manifest contract, and the substrate contract (`./substrate`).
 *
 * **Experimental.** The substrate contract published here is expected to change
 * until a second, non-DOM substrate has been built against it; it is versioned
 * with the package but not covered by its stability promise yet. The rest of
 * this surface (discovery, catalog, manifest, groups, case-tree construction)
 * is long-standing internal API being published as-is.
 *
 * @example
 * import { caseTree, type Substrate } from '@awarebydefault/display-case/core'
 *
 * export function mySubstrate(): Substrate<MyFrame> {
 *   return {
 *     id: 'my-substrate',
 *     variants: [...],
 *     render: (tree, ctx) => paint(tree, ctx),
 *     serialize: (frame) => ({ bytes: frame.toBytes(), ext: 'txt' }),
 *     document: (frame, ctx) => wrap(frame),
 *   }
 * }
 */

export type {
  A11yContrast,
  A11yImpact,
  A11yNodeDetail,
  A11yViolation,
  AuditOptions,
  BooleanTweak,
  Case,
  CaseContext,
  CaseMeta,
  CaseModule,
  CheckConfig,
  CheckPhase,
  ChoiceTweak,
  DiffFn,
  DiffResult,
  DisplayCaseConfig,
  FlowStep,
  GotoFn,
  GraphBudgetConfig,
  HierarchyLevel,
  NavConfig,
  NavGroupsConfig,
  NavSurfaceRule,
  NumberTweak,
  RenderDriver,
  RenderedPage,
  SimpleCase,
  SnapshotProviders,
  StructureRuleId,
  StructureRuleOptions,
  StructureRuleSetting,
  StructureSeverity,
  StyleCollector,
  StyleEngine,
  TextTweak,
  ThemeConfig,
  ThemeSignal,
  TweakDescriptor,
  TweakedCase,
  TweakSchema,
  TweakValues,
} from '../index'
export {
  defineCases,
  defineConfig,
  defineFlow,
  flowStep,
  HIERARCHY_LEVELS,
  isSurfaceLevel,
  normalizeGroup,
  tweak,
} from '../index'
export type { CaseTreeState } from '../render/render-node'
export {
  caseTree,
  encodeOverrides,
  NOOP_GOTO,
  resolveTweaks,
} from '../render/render-node'
export type { CatalogCase, CatalogComponent } from './catalog'
export { buildCatalog, findCase, slugify } from './catalog'
export type { LoadError, LoadedModule } from './discovery'
export {
  baselineDir,
  cacheDir,
  discoverCaseFiles,
  loadModules,
  resolveConfig,
} from './discovery'
export {
  buildGroupTree,
  deriveGroupFromFolder,
  makeGroupResolver,
} from './groups'
export type {
  BrowseMode,
  Manifest,
  ManifestCase,
  ManifestComponent,
  ManifestGroup,
} from './manifest'
export { BROWSE_MODES } from './manifest'
export type {
  CheckFinding,
  SerializedFrame,
  StageMessage,
  StageReadyMessage,
  StageRenderMessage,
  StageStepChangedMessage,
  Substrate,
  SubstrateCaptureContext,
  SubstrateCaseAddress,
  SubstrateChecks,
  SubstrateDocumentContext,
  SubstrateDocumentResources,
  SubstrateRenderContext,
  SubstrateStage,
  SubstrateTokensContext,
  SubstrateVariantAxis,
  SubstrateVariantValue,
  VariantSession,
} from './substrate'
