import { defineCases } from '@awarebydefault/display-case'

/**
 * A real Bootstrap 5.3 component. Bootstrap themes off `data-bs-theme` on an
 * ancestor (its shipped CSS carries `[data-bs-theme=dark]` rules), so when
 * Display Case's `bootstrap` signal sets that attribute on the document root the
 * card's surface re-themes. No build step — Bootstrap's stylesheet is loaded
 * verbatim via `globalStyles`.
 */
export default defineCases(
  'Bootstrap card',
  {
    Default: () => (
      <div className="card" data-testid="bs-card" style={{ width: 240 }}>
        <div className="card-body">
          <h5 className="card-title">Bootstrap</h5>
          <p className="card-text">Themed by data-bs-theme.</p>
        </div>
      </div>
    ),
  },
  { level: 'molecule' },
)
