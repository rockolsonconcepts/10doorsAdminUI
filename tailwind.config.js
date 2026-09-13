/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-sans)'] },
      boxShadow: {
        card: 'var(--shadow-md)',
        'card-hover': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
