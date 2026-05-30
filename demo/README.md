# Beam Store — BeamPay Checkout demo

A fake storefront that demonstrates the `@beampay/checkout` widget end-to-end on
**BSC testnet**, for both roles:

- **Merchant** signs an EIP-712 order at beampay-web `/create` and gets a pay link.
- **Buyer** pastes that link into the store and pays through the real widget.

The widget submits a real `pay()` transaction and polls `getOrder()` on-chain — **no
backend required**.

## Run

```bash
yarn install
yarn dev          # Vite dev server
# open http://localhost:5173/demo/
```

End-to-end flow:

1. Connect MetaMask on **BSC Testnet (97)** and click **Get test tUSDT** (faucet).
2. Fill the merchant/receiver address, click **Open /create to sign** — sign the order in
   beampay-web (defaults to `http://localhost:3002/create`; override with `VITE_CREATE_URL`).
3. Copy the generated pay link, paste it into the store, click **Load order into widget**.
4. Click **Pay with BeamPay** → approve tUSDT → confirm → the success screen links to the
   `testnet.bscscan.com` transaction.

## Integrating the widget in your own site

The widget is framework-agnostic — drop it into any page.

**ESM / npm:**

```ts
import { BeamPayCheckout } from '@beampay/checkout'

new BeamPayCheckout({
  chain: 'bsc-testnet',
  merchant: '0x…',      // order owner / refund caller
  receiver: '0x…',      // signed payout destination
  token: '0x…',         // ERC-20 address, or NATIVE_TOKEN sentinel
  amount: '1500000',    // wei (base units)
  orderId: '0x…',       // 32-byte order id
  signer: '0x…',        // EIP-712 signer
  createdAt: 1717000000,
  expiresAt: 1717086400,
  signature: '0x…',     // 65-byte EIP-712 signature
  decimals: 6,          // display only
  symbol: 'tUSDT',      // display only
  onSuccess: (order) => console.log('paid', order.txHash),
  onError: (err) => console.error(err),
}).mount('#pay')
```

**CDN / IIFE:**

```html
<div id="pay"></div>
<script src="https://cdn.beampay.fun/checkout/v1.js" defer></script>
<script>
  BeamPay.init({ /* same options as above */ }).mount('#pay')
</script>
```

The signed-order envelope (`merchant`/`receiver`/`token`/`amount`/`orderId`/`signer`/
`createdAt`/`expiresAt`/`signature`) is exactly what a beampay-web `/pay?…` link carries —
parse those query params straight into the options (see `demo/main.ts` `parsePayLink`).
