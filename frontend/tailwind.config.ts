import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nexus: {
          black: '#1a1921',
          panel: 'rgba(26, 25, 33, 0.74)',
          emerald: '#50c878',
          magenta: '#c850a0',
          red: '#E14664',
          white: '#f9fafd',
        },
        error: {
          red: '#E14664',
        },
      },
      fontFamily: {
        tomorrow: ['Tomorrow', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1100px',
      },
    },
  },
  plugins: [],
};

export default config;
