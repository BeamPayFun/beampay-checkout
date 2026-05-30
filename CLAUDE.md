# beam-checkout

Embeddable checkout widget — Lit 3 web components + vanilla Wagmi + viem.

## Key files
- `src/index.ts` — public entry: `BeamPay` global (IIFE) + `BeamPayCheckout` class (ESM)
- `src/elements/` — Lit custom elements (pay-button, pay-modal, wallet-picker, status-screen)
- `src/controllers/pay-controller.ts` — orchestrates wallet → tx → poll → callback
- `src/controllers/wagmi-config.ts` — @wagmi/core createConfig
- `src/lib/api.ts` — thin @beam/sdk wrapper
- `fixtures/merchant-page.html` — static page for e2e tests

## Build
- `yarn build` — produces IIFE + ESM in dist/
- `yarn test` — Vitest unit tests
- `yarn e2e` — Playwright cross-browser tests
