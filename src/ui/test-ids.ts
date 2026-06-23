/**
 * Display Case — stable test ids for the browse chrome.
 *
 * These power the package's own end-to-end tests (see `e2e/`). They are the
 * single source of truth for chrome locators.
 *
 * The chrome (`shell.tsx`, `NavItem.tsx`) applies these as `data-testid`
 * attributes; e2e specs import this module and pass the constants/builders to
 * Playwright's `getByTestId` — never a raw text/role selector. See
 * `contributing/testing-best-practices.md` for the locator discipline.
 */

export const DcTestIds = {
  /** The chrome root (`<div class="dc-app">`). Present once the manifest loads. */
  app: 'dc-app',
  /** The bracketed wordmark in the header, showing the showcase title. */
  wordmark: 'dc-wordmark',
  /** The Dark/Light theme toggle button. */
  themeToggle: 'dc-theme-toggle',
  /** The component-tree nav rail (`<nav>` landmark). */
  sidebar: 'dc-sidebar',
  /** The preview `<iframe>` the selected case renders inside. */
  stageFrame: 'dc-stage-frame',
  /** The Docs toggle in the header (only when the component has a placard doc). */
  docsButton: 'dc-docs-button',
  /** The documentation side panel (only while open). */
  docPanel: 'dc-doc-panel',
  /** The stage grid toggle in the header (decorated components only). */
  gridButton: 'dc-grid-button',
  /** The stage's accessibility panel (only once the case has been audited). */
  a11yPanel: 'dc-a11y-panel',
  /** The show/hide toggle in the accessibility panel's header. */
  a11yToggle: 'dc-a11y-toggle',
  /** The "re-scan this variant" button in the accessibility panel's header. */
  a11yRescan: 'dc-a11y-rescan',

  /** A sidebar component row's select button, keyed by component id. */
  navComponent: (id: string): string => `dc-nav-component-${id}`,
  /** A sidebar component row's accessibility-violation marker, keyed by
   *  component id (present only when that component has violations). */
  navAlert: (id: string): string => `dc-nav-alert-${id}`,
  /** A sidebar component row's disclosure chevron, keyed by component id. */
  navComponentToggle: (id: string): string => `dc-nav-component-toggle-${id}`,
  /** A sidebar case row's select button. Case ids are unique only within a
   *  component, so it's scoped by the owning component id. */
  navCase: (componentId: string, caseId: string): string =>
    `dc-nav-case-${componentId}-${caseId}`,
  /** A mode-switch tab (Primer · Components · Exhibits), keyed by mode. */
  modeSwitch: (mode: 'primer' | 'components' | 'exhibits'): string =>
    `dc-modeswitch-${mode}`,
  /** The sidebar filter input. */
  navFilter: 'dc-nav-filter',
  /** The sidebar resize handle (drag/keyboard to widen the rail). */
  sidebarResize: 'dc-sidebar-resize',
  /** An Exhibits-mode group row, keyed by its lowercased `/`-joined path. */
  navGroup: (path: string): string => `dc-nav-group-${path}`,
  /** The active surface's group-path breadcrumb in the stage header. */
  breadcrumb: 'dc-breadcrumb',
  /** A violation row in the accessibility panel, keyed by its axe rule id
   *  (e.g. 'color-contrast'); present only for a failing variant. */
  a11yViolation: (ruleId: string): string => `dc-a11y-violation-${ruleId}`,
} as const
