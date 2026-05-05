/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // MusicBridge palette — restrained, editorial.
        // Surfaces alternate between near-white and a soft off-white.
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F7F6F2',
          muted: '#EFEDE6',
        },
        ink: {
          DEFAULT: '#0E0E0E',
          soft: '#3A3A3A',
          muted: '#6B6B6B',
        },
        accent: {
          DEFAULT: '#1F4ED8',
          soft: '#E0E7FF',
        },
      },
      fontFamily: {
        display: ['System'],
        body: ['System'],
      },
    },
  },
  plugins: [],
};
