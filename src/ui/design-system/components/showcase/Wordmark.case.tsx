import { defineCases, tweak } from 'display-case'
import { Wordmark } from './Wordmark'

export default defineCases(
  'Wordmark',
  {
    Playground: {
      tweaks: {
        text: tweak.text('Display Case'),
        fontSize: tweak.number(1.5),
        maxWidth: tweak.number(0),
      },
      render: (t) => (
        <Wordmark
          style={{
            fontSize: `${t.fontSize}rem`,
            maxWidth: t.maxWidth ? `${t.maxWidth}rem` : undefined,
          }}>
          {t.text}
        </Wordmark>
      ),
    },
    Default: () => (
      <Wordmark style={{ fontSize: '1.5rem' }}>Display Case</Wordmark>
    ),
    Sizes: () => (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
        <Wordmark style={{ fontSize: '0.875rem' }}>Small</Wordmark>
        <Wordmark style={{ fontSize: '1.25rem' }}>Medium</Wordmark>
        <Wordmark style={{ fontSize: '2rem' }}>Large</Wordmark>
      </div>
    ),
    // The brackets stay pinned to the ends and stretch to the full text height
    // as the text wraps inside them — they never wrap along with it.
    Wrapping: () => (
      <Wordmark style={{ fontSize: '1.5rem', maxWidth: '6rem' }}>
        Display Case
      </Wordmark>
    ),
  },
  { level: 'atom' },
)
