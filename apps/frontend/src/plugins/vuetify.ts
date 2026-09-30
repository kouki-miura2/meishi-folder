import '@mdi/font/css/materialdesignicons.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'vuetify/styles'
import './fonts.css'
import '../styles/app.css'
import { createVuetify } from 'vuetify'

/**
 * The "paper" theme from the screen design (docs/spec.md): off-white paper, ink-black
 * text and rules, and exactly three meaning colors — project red, group blue, AI-review yellow.
 */
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'paper',
    themes: {
      paper: {
        dark: false,
        colors: {
          background: '#F5F3EE',
          surface: '#FFFFFF',
          'surface-variant': '#EEEAE1',
          'on-surface-variant': '#1B1A17',
          primary: '#1B1A17',
          'on-primary': '#F5F3EE',
          secondary: '#6B675F',
          error: '#B3372B',
          warning: '#A06A00',
          project: '#B3372B',
          group: '#2456A6',
          caution: '#6B4700',
          'caution-soft': '#F6E7B9',
        },
        variables: {
          'border-color': '#1B1A17',
          'border-opacity': 0.14,
          'high-emphasis-opacity': 1,
          'medium-emphasis-opacity': 0.72,
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'lg', class: 'text-none font-weight-bold' },
    VTextField: {
      variant: 'outlined',
      rounded: 'lg',
      bgColor: 'surface',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VTextarea: { variant: 'outlined', rounded: 'lg', bgColor: 'surface', hideDetails: 'auto' },
    VCombobox: {
      variant: 'outlined',
      rounded: 'lg',
      bgColor: 'surface',
      density: 'comfortable',
      hideDetails: 'auto',
    },
    VChip: { rounded: 'pill', variant: 'tonal', class: 'font-weight-bold' },
    VBtnToggle: { rounded: 'lg', density: 'comfortable' },
  },
})
