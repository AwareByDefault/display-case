import { defineCases } from 'display-case'
import { ShellView } from './ShellView'
import {
  caseTemplateSelection,
  makeModel,
  PlaceholderExhibit,
} from './shell-fixtures'

/**
 * The Cases layout as a *template*: the chrome's header, nav rail, stage, tweaks
 * panel, and docs panel arranged around placeholder content. It shows the shape
 * a case page takes before any real component, tweak, or doc fills it — the
 * empty template a {@link defineCases} page is poured into.
 */
export default defineCases(
  'Case template',
  {
    Default: () => (
      <ShellView
        {...makeModel({
          ...caseTemplateSelection(),
          docText: '_Placeholder documentation lives here._',
          boxW: 260,
          boxH: 150,
        })}
        renderFrame={<PlaceholderExhibit />}
        primerFrame={null}
      />
    ),
  },
  { level: 'template' },
)
