import { defineCases } from '@awarebydefault/display-case'

/**
 * A real Tailwind CSS component using the class strategy: `dark:` variants apply
 * under a `.dark` ancestor. Display Case's default `class` signal toggles the
 * `dark` class on the document root, so this box flips from a light to a dark
 * surface with the theme. The stylesheet is compiled by the real `tailwindcss`
 * CLI in the fixture server's startup command (see `playwright.config.ts`) and
 * loaded via `globalStyles`.
 */
export default defineCases(
  'Tailwind box',
  {
    Default: () => (
      <div
        data-testid="tw-box"
        className="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 p-8 rounded">
        Tailwind
      </div>
    ),
  },
  { level: 'molecule' },
)
