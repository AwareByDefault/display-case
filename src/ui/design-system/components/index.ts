/**
 * Display Case design-system components — "The Vitrine".
 * Self-contained, pure React components (each brings its own CSS). Used by the
 * browse chrome and dogfooded as Display Case's own showcased components.
 */

export type { ButtonProps, ButtonSize, ButtonVariant } from './controls/Button'
export { Button } from './controls/Button'
export type {
  IconButtonProps,
  IconButtonSize,
  IconButtonVariant,
} from './controls/IconButton'
export { IconButton } from './controls/IconButton'
export type { InputProps, InputSize } from './controls/Input'
export { Input } from './controls/Input'
export type {
  SelectItem,
  SelectOption,
  SelectOptionGroup,
  SelectProps,
  SelectSize,
} from './controls/Select'
export { Select } from './controls/Select'
export type {
  SelectMenuOption,
  SelectMenuProps,
  SelectMenuSize,
} from './controls/SelectMenu'
export { SelectMenu } from './controls/SelectMenu'
// Reusable Primer foundation specimens (ramps, swatches, type scale, glyphs…)
// — generic, prop-driven primitives for building a Primer.
export * from './primer-specimen'
export type { A11yBadgeProps } from './showcase/A11yBadge'
export { A11yBadge } from './showcase/A11yBadge'
export type { A11yPanelProps } from './showcase/A11yPanel'
export { A11yPanel } from './showcase/A11yPanel'
export type { ChipProps, ChipVariant } from './showcase/Chip'
export { Chip } from './showcase/Chip'
export type { EyebrowProps, EyebrowTone } from './showcase/Eyebrow'
export { Eyebrow } from './showcase/Eyebrow'
export type { FlowNavProps, FlowStep } from './showcase/FlowNav'
export { FlowNav } from './showcase/FlowNav'
export type { ImpactTagProps } from './showcase/ImpactTag'
export { ImpactTag, impactRank } from './showcase/ImpactTag'
export type { NavItemKind, NavItemProps } from './showcase/NavItem'
export { NavItem } from './showcase/NavItem'
export type { RenderAddressProps } from './showcase/RenderAddress'
export { RenderAddress } from './showcase/RenderAddress'
export type {
  SegmentedOption,
  SegmentedToggleProps,
} from './showcase/SegmentedToggle'
export { SegmentedToggle } from './showcase/SegmentedToggle'
export type { SidebarProps } from './showcase/Sidebar'
export { Sidebar } from './showcase/Sidebar'
export type { StageProps } from './showcase/Stage'
export { Stage } from './showcase/Stage'
export type {
  TweakItem,
  TweaksMode,
  TweaksPanelProps,
} from './showcase/TweaksPanel'
export { Row as TweakRow, TweaksPanel } from './showcase/TweaksPanel'
export type { WordmarkProps } from './showcase/Wordmark'
export { Wordmark } from './showcase/Wordmark'
