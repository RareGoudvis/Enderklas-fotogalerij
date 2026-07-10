/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Schoolbranding (brief §0)
        accent: {
          DEFAULT: '#00aad3', // schoolcyaan
          fg: '#ffffff',
        },
        ink: '#1a1a1a',
      },
      fontFamily: {
        // Geometrische sans; Poppins met system-fallback tot de webfont geladen is.
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // Mobile-first: touch targets ≥ 44px (brief §0).
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
