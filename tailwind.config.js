/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#00628c",
        "primary-dim": "#00557b",
        "primary-container": "#34b5fa",
        "primary-fixed": "#34b5fa",
        "primary-fixed-dim": "#17a8ec",
        "on-primary": "#e9f4ff",
        "on-primary-container": "#003047",
        "on-primary-fixed": "#00121e",
        "on-primary-fixed-variant": "#003954",
        "inverse-primary": "#34b5fa",

        "secondary": "#006947",
        "secondary-dim": "#005c3d",
        "secondary-container": "#69f6b8",
        "secondary-fixed": "#69f6b8",
        "secondary-fixed-dim": "#58e7ab",
        "on-secondary": "#c8ffe0",
        "on-secondary-container": "#005a3c",
        "on-secondary-fixed": "#00452d",
        "on-secondary-fixed-variant": "#006544",

        "tertiary": "#994100",
        "tertiary-dim": "#863800",
        "tertiary-container": "#ff955a",
        "tertiary-fixed": "#ff955a",
        "tertiary-fixed-dim": "#ff7f2f",
        "on-tertiary": "#fff0e9",
        "on-tertiary-container": "#552100",
        "on-tertiary-fixed": "#2e0e00",
        "on-tertiary-fixed-variant": "#632800",

        "error": "#b31b25",
        "error-dim": "#9f0519",
        "error-container": "#fb5151",
        "on-error": "#ffefee",
        "on-error-container": "#570008",

        "surface": "#f4f6ff",
        "surface-dim": "#bdd6fc",
        "surface-bright": "#f4f6ff",
        "surface-variant": "#c9deff",
        "surface-tint": "#00628c",
        "surface-container": "#dce9ff",
        "surface-container-low": "#eaf1ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#d2e4ff",
        "surface-container-highest": "#c9deff",

        "on-surface": "#203044",
        "on-surface-variant": "#4d5d73",
        "inverse-surface": "#000f21",
        "inverse-on-surface": "#8e9eb7",

        "background": "#f4f6ff",
        "on-background": "#203044",

        "outline": "#68788f",
        "outline-variant": "#9eaec7",
      },
      fontFamily: {
        "headline": ["Plus Jakarta Sans", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
        "label": ["Manrope", "sans-serif"],
        "mono": ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        // Ethereal Navigator — tinted with on-surface, never black
        "ambient": "0 12px 40px rgba(32, 48, 68, 0.06)",
        "floating": "0 16px 48px rgba(32, 48, 68, 0.08)",
        "glow-sky": "0 0 0 4px rgba(0, 98, 140, 0.16)",
        "glow-sunset": "0 0 28px rgba(255, 149, 90, 0.20)",
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(1rem)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'focus-highlight': {
          // Flash a sky ring while keeping the card's resting ambient shadow,
          // so a highlighted activity card doesn't lose its background/elevation.
          '0%, 55%': {
            boxShadow: '0 0 0 2px #00628c, 0 12px 40px rgba(32, 48, 68, 0.06)',
          },
          '100%': {
            boxShadow: '0 12px 40px rgba(32, 48, 68, 0.06)',
          },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.25s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out both',
        'focus-highlight': 'focus-highlight 3s ease-out forwards',
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        // Ethereal Navigator — more generous, semantic radii (added, not overriding)
        "card": "1.25rem",
        "hero": "1.75rem",
        "full": "9999px",
      },
    },
  },
  plugins: [],
}
