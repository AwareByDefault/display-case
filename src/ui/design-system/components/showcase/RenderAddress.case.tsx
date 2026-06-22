import { defineCases, tweak } from '@awarebydefault/display-case'
import { RenderAddress } from './RenderAddress'

export default defineCases(
  'RenderAddress',
  {
    Playground: {
      tweaks: {
        method: tweak.text('GET'),
        url: tweak.text(
          '/render/button/playground?theme=light&t.variant=accent',
        ),
      },
      render: (t) => <RenderAddress method={t.method} url={t.url} />,
    },
    Default: () => (
      <RenderAddress url="/render/button/playground?theme=light&t.variant=accent" />
    ),
  },
  { level: 'molecule' },
)
