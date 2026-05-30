export { BeamPayCheckout } from './controllers/pay-controller'

import { BeamPayCheckout } from './controllers/pay-controller'

// IIFE global — window.BeamPay in CDN builds
export const BeamPay = {
  init(opts: ConstructorParameters<typeof BeamPayCheckout>[0]) {
    return new BeamPayCheckout(opts)
  },
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { BeamPay: typeof BeamPay }).BeamPay = BeamPay
}
