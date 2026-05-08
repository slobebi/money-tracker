import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set VITE_BASE_PATH to your repo name e.g. /money-tracker/
  base: process.env.VITE_BASE_PATH || '/',
})
