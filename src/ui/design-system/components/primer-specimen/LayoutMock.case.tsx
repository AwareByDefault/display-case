import { defineCases, tweak } from '@awarebydefault/display-case'
import { LayoutMock } from './LayoutMock'

export default defineCases(
  'LayoutMock',
  {
    Playground: {
      tweaks: {
        header: tweak.text('header'),
        sidebar: tweak.text('sidebar'),
        main: tweak.text('main · the stage'),
        sidebarWidth: tweak.text('32%'),
      },
      render: (t) => (
        <LayoutMock
          header={t.header}
          sidebar={t.sidebar}
          main={t.main}
          sidebarWidth={t.sidebarWidth || undefined}
        />
      ),
    },
    Shell: () => (
      <LayoutMock header="header" sidebar="sidebar" main="main · the stage" />
    ),
    WideSidebar: () => (
      <LayoutMock
        header="toolbar"
        sidebar="nav tree"
        main="preview"
        sidebarWidth="44%"
      />
    ),
  },
  { level: 'molecule' },
)
