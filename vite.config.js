import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from https://<user>.github.io/<repo>/, so assets need that
// repo-name subpath baked in. The deploy workflow sets VITE_BASE_PATH from the actual repo
// name at build time; locally (npm run dev) it's unset and falls back to "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
