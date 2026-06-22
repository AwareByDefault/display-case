/**
 * Example: a plain case.
 *
 * The simplest shape — one component, one named case whose value is a thunk
 * returning a React node. No tweaks, no flow. Copy this next to your component
 * as `<component>.case.tsx`.
 *
 * Subject: `TweakControl`, Display Case's own atom — a single tweak input.
 * Display Case dogfoods itself, so its UI parts make good case subjects.
 *
 * See ../writing-cases.md for the full authoring API.
 */
import { defineCases } from '@awarebydefault/display-case'
import { TweakControl } from './tweak-control'

export default defineCases(
  'TweakControl',
  {
    Default: () => <TweakControl kind="text" label="Label" value="Save" />,
  },
  { level: 'atom' },
)
