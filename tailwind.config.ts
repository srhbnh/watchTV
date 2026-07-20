import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12100E',        // fond principal, quasi-noir chaud (pas un noir pur générique)
        tape: '#1D1A17',       // surfaces / cartes
        ribbon: '#2A2521',     // bordures, séparateurs
        paper: '#EDE7DC',      // texte principal, blanc cassé chaud
        muted: '#948B7E',      // texte secondaire
        rec: '#E4572E',        // accent "REC" — rouge-orangé cassette/VHS, pas le terracotta Claude
        tracking: '#4E8F7C',   // accent secondaire — vert "tracking OK" façon magnétoscope
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        tape: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
