/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0D6EFD',
        'secondary': '#6C757D',
        'success': '#198754',
        'danger': '#DC3545',
        'warning': '#FFC107',
        'info': '#0DCAF0',
        'background': '#F8FAFC',
        'card': '#FFFFFF',
        'border': '#E2E8F0',
        'text': '#1E293B',
        'text-light': '#64748B',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
}