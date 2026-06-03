import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Standalone static build of the `demo/` storefront for Cloudflare Pages
// (beampay-demo.pages.dev). The main `vite.config.ts` is lib-mode (builds the
// widget bundle), so the demo needs its own non-lib build. Root stays at the
// project so `/demo/main.ts` and the `../src` imports in main.ts resolve the
// same way they do under `vite dev`.
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'demo/index.html'),
    },
    target: ['chrome110', 'safari16', 'firefox110'],
  },
})
