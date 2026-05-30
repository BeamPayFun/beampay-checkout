/**
 * Tailwind utilities compiled into a shadow-DOM-scoped stylesheet.
 *
 * The actual CSS is imported inline via Vite's ?inline query so it can be
 * injected into each shadow root without leaking into the host page.
 *
 * Usage in a Lit component:
 *   import { shadowStyles } from '../lib/styles.js'
 *   static styles = [shadowStyles]
 */
import { css, unsafeCSS } from 'lit'

// Vite inlines the compiled Tailwind CSS as a string at build time.
// At runtime (dev server) the import resolves to the raw CSS text.
// The ?inline suffix prevents Vite from injecting it into <head>.
// @ts-expect-error — resolved by Vite at build time
import tailwindInline from './styles.css?inline'

export const shadowStyles = css`
  ${unsafeCSS(tailwindInline)}
`
