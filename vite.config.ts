import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BeamPay',
      formats: ['iife', 'es'],
      fileName: (fmt) => (fmt === 'iife' ? 'checkout.iife.js' : 'checkout.es.js'),
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: ['chrome110', 'safari16', 'firefox110'],
    sourcemap: true,
  },
})
