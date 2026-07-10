import { defineCases } from '@awarebydefault/display-case'
import Paper from '@mui/material/Paper'
import { createTheme, ThemeProvider } from '@mui/material/styles'

/**
 * A real Material UI component in CSS-variables mode. MUI generates palette CSS
 * variables scoped to `data-mui-color-scheme` — the exact attribute Display Case's
 * `mui` signal sets on the document root. MUI's provider insists on *owning* that
 * attribute (it writes its own current mode), so we hand it Display Case's theme as
 * its mode: the case is `browserOnly`, so reading the harness theme off the
 * document at render is legal (client-only), and MUI then writes the same value
 * Display Case did — they agree and the Paper re-themes.
 *
 * A per-mode `modeStorageKey` keeps MUI's localStorage from carrying one theme's
 * mode into the next page load (each `/render` theme is a fresh navigation).
 */
const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
})

export default defineCases(
  'MUI paper',
  {
    Default: () => {
      const mode =
        document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'dark'
          : 'light'
      return (
        <ThemeProvider
          theme={theme}
          defaultMode={mode}
          modeStorageKey={`dc-mui-${mode}`}>
          <Paper data-testid="mui-paper" sx={{ p: 4, width: 200 }}>
            Material UI
          </Paper>
        </ThemeProvider>
      )
    },
  },
  { level: 'molecule', browserOnly: true },
)
