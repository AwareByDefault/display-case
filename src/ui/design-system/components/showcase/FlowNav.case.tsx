import { defineCases, tweak } from 'display-case'
import { FlowNav } from './FlowNav'

const steps = [
  { id: 'request-link', label: 'Request link' },
  { id: 'check-email', label: 'Check email' },
  { id: 'signed-in', label: 'Signed in' },
]

export default defineCases(
  'FlowNav',
  {
    Playground: {
      tweaks: {
        active: tweak.choice(
          ['request-link', 'check-email', 'signed-in'],
          'check-email',
        ),
      },
      render: (t) => (
        <FlowNav steps={steps} activeId={t.active} onSelect={() => {}} />
      ),
    },
    Start: () => (
      <FlowNav steps={steps} activeId="request-link" onSelect={() => {}} />
    ),
    Middle: () => (
      <FlowNav steps={steps} activeId="check-email" onSelect={() => {}} />
    ),
    End: () => (
      <FlowNav steps={steps} activeId="signed-in" onSelect={() => {}} />
    ),
  },
  { level: 'molecule' },
)
