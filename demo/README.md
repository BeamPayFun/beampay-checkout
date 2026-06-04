# Beam Store — BeamPay Checkout demo

A fake storefront that exercises the `@beampay/checkout` widget end-to-end on
**BSC testnet**, across all three integration modes. Orders are signed by a
**self-hosted merchant signer** (`examples/demo-signer` in beampay-libs) — the
widget never signs, and BeamPay holds zero keys.

## Modes

| Mode | Flow | What the demo does |
|---|---|---|
| **A · Pay link** | push | Signs once, packs the envelope into a flat-query pay link, mounts via `BeamPay.fromLink(href)`. |
| **B · Inline** | push | Pre-signs the current cart via the signer backend, hands the envelope to `BeamPay.init({ order })`. Cart locked. |
| **C · Callback** | pull | Cart stays editable; `BeamPay.init({ createOrder })` calls the signer `/sign` at pay time with the live cart. |

In all three the buyer wallet only signs `pay()`; the widget polls `getOrder()`
on-chain — **no backend on the payer side** (Mode C aside, which needs the
merchant's `/sign`).

## Run

```bash
# 1. start the merchant signer (separate repo)
cd ../../beampay-libs/examples/demo-signer
cp .dev.vars.example .dev.vars         # put a BSC-testnet burner key in MERCHANT_KEY
pnpm --filter @beampay/demo-signer dev # → http://localhost:8787

# 2. start the store
cd ../../../beampay-checkout
yarn dev                                # open the printed URL
```

Point the store at a different signer with `VITE_SIGNER_URL` (defaults to
`http://localhost:8787`).

End-to-end:

1. Connect MetaMask on **BSC Testnet (97)**, click **Get test tUSDT** (faucet)
   and grab some tBNB for gas.
2. Pick a mode (A / B / C). For C, adjust the cart.
3. Click **Pay with BeamPay** → approve tUSDT → confirm → the success screen
   links to the `testnet.bscscan.com` transaction.

## Integrating the widget in your own site

```ts
import { BeamPay } from '@beampay/checkout'

// Mode A — a beampay-web pay link
BeamPay.fromLink(href, { decimals: 6, symbol: 'tUSDT' }).mount('#pay')

// Mode B — inline pre-signed envelope
BeamPay.init({ order: signedEnvelope, decimals: 6, symbol: 'tUSDT' }).mount('#pay')

// Mode C — sign on demand from your backend
BeamPay.init({
  createOrder: () => fetch('/sign', { method: 'POST', body }).then((r) => r.json()),
  decimals: 6,
  symbol: 'tUSDT',
}).mount('#pay')
```

CDN / IIFE exposes the same `window.BeamPay`.
