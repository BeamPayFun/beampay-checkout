import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Standalone static build of the `demo/` storefront for Cloudflare Pages. The
// entry is `demo/checkout.html`, so the build emits `dist-demo/checkout.html`,
// which CF Pages serves at both `/checkout.html` and the clean URL `/checkout`.
// The main `vite.config.ts` is lib-mode (builds the widget bundle), so the demo
// needs its own non-lib build. `root` is the `demo/` dir; `../src` imports in
// main.ts resolve at build time.
export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'demo/checkout.html'),
    },
    target: ['chrome110', 'safari16', 'firefox110'],
  },
})
