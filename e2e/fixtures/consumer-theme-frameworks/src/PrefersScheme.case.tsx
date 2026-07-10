import { defineCases } from '@awarebydefault/display-case'

/**
 * A component themed ONLY through `@media (prefers-color-scheme)` — the one signal
 * a served page cannot set for itself. It does NOT follow Display Case's
 * interactive toggle (correct: it follows the OS). It is here to prove the
 * capture path: Display Case's snapshot/audit driver emulates the color-scheme
 * preference, so this component is captured in the requested theme. The e2e drives
 * it with the same media emulation the driver uses.
 */
export default defineCases(
  'Prefers-color-scheme box',
  {
    Default: () => (
      <>
        <style>{`.dcps{background:#ffffff;color:#000000;padding:2rem;border-radius:4px}@media (prefers-color-scheme: dark){.dcps{background:#000000;color:#ffffff}}`}</style>
        <div className="dcps" data-testid="ps-box">
          prefers-color-scheme
        </div>
      </>
    ),
  },
  { level: 'molecule' },
)
