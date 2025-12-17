/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'kollab': {
          bg: '#0F0F0F',
          surface: '#1A1A1A',
          'surface-elevated': '#252525',
          primary: '#8B5CF6',
          'primary-light': '#A78BFA',
          text: '#FFFFFF',
          'text-secondary': '#A0A0A0',
          border: '#333333',
          success: '#22C55E',
          error: '#EF4444',
        },
      },
    },
  },
  plugins: [],
}
