import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Generates .map files without a //# sourceMappingURL comment in the
    // shipped JS, so production errors stay mappable (paste into a source
    // map viewer, or wire into an error tracker) without publicly serving
    // source alongside the bundle.
    sourcemap: 'hidden',
  },
})
