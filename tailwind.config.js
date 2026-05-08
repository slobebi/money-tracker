/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0f1117',
        surface: '#1a1d27',
        border:  '#2a2d3a',
        accent:  '#6c63ff',
        accent2: '#f5a623',
        muted:   '#6b7080',
        ink:     '#e2e4ef',
        green:   '#3ecf8e',
        danger:  '#f25f5c',
      },
    },
  },
  // Disable preflight to avoid conflicts with antd's CSS reset
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
