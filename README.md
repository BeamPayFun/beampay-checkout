# @beampay/checkout

Framework-agnostic embeddable payment widget for BeamPay.

## CDN usage

```html
<script src="https://cdn.beampay.fun/checkout/v1.js" defer></script>
<button id="pay"></button>
<script>
  BeamPay.init({
    apiUrl: 'https://api.beampay.fun',
    chain: 'bsc',
    merchant: '0x...',
    token: '0x55d398326f99059fF775485246999027B3197955',
    amount: '100000000',
    onSuccess: (order) => console.log('paid', order),
    onError: (err) => console.error(err),
  }).mount('#pay')
</script>
```

## npm usage

```ts
import { BeamPayCheckout } from '@beampay/checkout'
const checkout = new BeamPayCheckout({ ... })
checkout.mount(document.querySelector('#pay'))
```
