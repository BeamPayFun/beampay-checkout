export { BeamPayCheckout } from './controllers/pay-controller'
export { parsePayLink } from './controllers/resolve'
export type {
  CheckoutInit,
  DisplayOpts,
  OrderEnvelope,
  OrderSource,
  OrderState,
  OrderStatus,
} from './types'

import { BeamPayCheckout } from './controllers/pay-controller'
import type { CheckoutInit, DisplayOpts } from './types'

// IIFE global — window.BeamPay in CDN builds
export const BeamPay = {
  /** Mount the widget from any order source (Mode A inline, B link, or C callback). */
  init(opts: CheckoutInit) {
    return new BeamPayCheckout(opts)
  },
  /** Mode B convenience — build the widget from a beampay-web flat-query pay link. */
  fromLink(href: string, display: DisplayOpts = {}) {
    return new BeamPayCheckout({ link: href, ...display })
  },
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { BeamPay: typeof BeamPay }).BeamPay = BeamPay
}
