// JAYL Brand Identity — single source of truth for brand constants
// Used across Navbar, Footer, meta tags, and any brand-sensitive UI.

export const BRAND = {
  name:    'JAYL',
  tagline: 'Art finds a way.',
  origin:  'Venice, Italy — Est. 2025',

  // Core palette
  colors: {
    ink:   '#111111',   // primary dark — text on light backgrounds
    cream: '#F5F0E8',   // warm off-white — primary light background
    muted: '#8A8A85',   // secondary text
    gold:  '#C4A35A',   // brand accent — JAYL gold
    white: '#FFFFFF',
  },

  // Typography
  typography: {
    display: 'Cormorant Garamond', // font-display — editorial serif, weight 300 italic
    sans:    'Space Grotesk',      // font-sans — clean grotesque, weight 300
    weight:  300,
  },
}

// Helper: returns the correct logo color for the current theme
// Usage: logoColor(isLight)  →  '#111111' | '#FFFFFF'
export const logoColor = (isLight) => isLight ? BRAND.colors.ink : BRAND.colors.white
