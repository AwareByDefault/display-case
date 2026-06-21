import { defineCases, tweak } from 'display-case'
import { Button } from '../controls/Button'
import { Stage } from './Stage'

const box = { width: '24rem', height: '12rem' }

export default defineCases(
  'Stage',
  {
    Playground: {
      tweaks: {
        caption: tweak.text('button / playground'),
        meta: tweak.text('390 × 844'),
        grid: tweak.boolean(true),
        corners: tweak.boolean(false),
      },
      render: (t) => (
        <Stage
          caption={t.caption || undefined}
          meta={t.meta || undefined}
          frame="fill"
          grid={t.grid}
          corners={t.corners}
          style={box}>
          <Button>On the stage</Button>
        </Stage>
      ),
    },
    Default: () => (
      <Stage frame="fill" style={box}>
        <Button>On the stage</Button>
      </Stage>
    ),
    Grid: () => (
      <Stage frame="fill" grid style={box}>
        <Button variant="accent">On the grid</Button>
      </Stage>
    ),
    Captioned: () => (
      <Stage
        caption="button / playground"
        meta="390 × 844"
        frame="fill"
        grid
        style={box}>
        <Button>Captioned</Button>
      </Stage>
    ),
  },
  { level: 'molecule' },
)
