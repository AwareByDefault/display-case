import { defineCases } from '@awarebydefault/display-case'
import mark from './assets/mark.svg'

/**
 * A component that imports a static image asset and renders it two ways an app
 * commonly does: as an `<img src>` and as a CSS `background-image`. Both consume
 * the same value binding the bundler rewrites the import to, so both break if the
 * asset URL doesn't resolve. The e2e (asset.spec.ts) asserts the `<img>` actually
 * decodes in a real browser (`naturalWidth > 0`) — the regression the fix targets.
 */
export default defineCases(
  'Asset',
  {
    Image: () => <img src={mark} alt="Sample mark" width={96} height={96} />,
    Background: () => (
      <div
        style={{
          width: 96,
          height: 96,
          backgroundImage: `url(${mark})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
    ),
  },
  { level: 'atom' },
)
