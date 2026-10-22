/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./presentes/**/*.html",
    "./luademel/**/*.html",
    "./admin/**/*.html",
    "./netlify/functions/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        rosa: "#e83a6d",
        laranja: "#ed4b14",
        amarelo: "#feb423",
        creme: "#fee3b4",
        marrom: "#3a2a1f",
        "marrom-claro": "#5e4130",
        terracota: "#d96c2b",
        verde: "#22c55e",
      },
      fontFamily: {
        titulos: ['Oleragie', 'Playfair Display', 'Georgia', 'serif'],
        paragrafos: ['Satoshi', 'Jost', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};