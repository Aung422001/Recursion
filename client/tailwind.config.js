/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Each non-Latin script needs a font that actually covers it, or it
        // renders as boxes on most Windows and Linux machines. System fallbacks
        // are listed after the webfont so text is readable before it loads.
        myanmar: ['Padauk', 'Myanmar Text', 'Noto Sans Myanmar', 'sans-serif'],
        thai: ['Noto Sans Thai', 'Leelawadee UI', 'Tahoma', 'sans-serif'],
        japanese: ['Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', 'Meiryo', 'sans-serif'],
        korean: ['Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
        devanagari: ['Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'sans-serif'],
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 150ms ease-out',
        shake: 'shake 300ms ease-in-out',
      },
    },
  },
  plugins: [],
};
