import type { Config } from 'tailwindcss';

// Paleta litorânea "C. Arias" — extraída fielmente do protótipo pms.html.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mar: { DEFAULT: '#28727c', escuro: '#1d5a63' },
        areia: { DEFAULT: '#f6f1e7', escuro: '#efe7d7' },
        superficie: '#ffffff',
        tinta: { DEFAULT: '#123038', suave: '#4c6a70' },
        coral: { DEFAULT: '#e07a5f', escuro: '#c95f44' },
        verde: '#2f9e6f',
        vermelho: '#c5503b',
        ambar: '#e9a13b',
        borda: { DEFAULT: '#e4dac6', forte: '#cfc2a6' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      borderRadius: {
        carias: '14px',
      },
      boxShadow: {
        carias:
          '0 1px 2px rgba(18,48,56,.06), 0 8px 24px rgba(18,48,56,.06)',
      },
    },
  },
  plugins: [],
};

export default config;
