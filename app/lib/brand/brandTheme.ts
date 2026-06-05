/** PitchIntel design tokens — source of truth for Tailwind/CSS */
export const brandTheme = {
  name: 'PitchIntel',
  tagline: 'Football Tactical Intelligence',
  description: 'Predictive match analysis, tactical insights, and probability intelligence.',
  colors: {
    background: '#071014',
    backgroundSoft: '#0B1118',
    panel: '#141C2B',
    panelElevated: '#1A2438',
    border: '#3D4F66',
    textPrimary: '#F8FAFC',
    textSecondary: '#C5D0E0',
    textMuted: '#9AAEC4',
    cyan: '#00E5FF',
    magenta: '#FF2D8E',
    green: '#22D46B',
    yellow: '#FFD400',
    slate: '#2A3342',
    white: '#FFFFFF',
    danger: '#FF4D5A',
  },
  fonts: {
    /** Plus Jakarta Sans + Be Vietnam Pro both include Vietnamese glyphs */
    heading: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
    body: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
    mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
  },
  radius: {
    card: '18px',
    panel: '24px',
    pill: '999px',
  },
  seo: {
    title: 'PitchIntel — Football Tactical Intelligence',
    description:
      'Predictive match analysis, tactical insights, and probability intelligence for serious football analysts.',
    ogImage: '/og-cover.png',
  },
} as const;
