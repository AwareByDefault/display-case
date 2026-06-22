import type { ReactNode } from 'react'

/** A trivial imported component used by the synthetic SSR round-trip test, to
 *  prove that mdx-lite imports resolve like any other TypeScript import. */
export function Box({ children }: { children?: ReactNode }) {
  return <span data-box="">{children}</span>
}
