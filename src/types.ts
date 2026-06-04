import type { OrderEnvelope } from '@beampay/schemas'
import type { Address, Hex } from 'viem'
import type { ChainKey } from './chains'

export type { OrderEnvelope }

/**
 * Where the widget gets its signed order from. The widget NEVER signs — the
 * merchant (or an on-chain delegate) signs the EIP-712 Order off-chain; the
 * widget only submits the buyer's `pay()`.
 *
 * - `order`       — Mode A (inline, push): a pre-signed envelope handed in directly.
 * - `link`        — Mode B (pay link, push): a beampay-web `?chain=…&sig=…` link.
 * - `createOrder` — Mode C (callback, pull): called at pay time to fetch a freshly
 *                   signed envelope from the merchant's own backend (dynamic price).
 */
export type OrderSource =
  | { order: OrderEnvelope }
  | { link: string }
  | { createOrder: (ctx?: unknown) => Promise<OrderEnvelope> }

/** Display + behavior options, independent of where the order comes from. */
export interface DisplayOpts {
  /** Token decimals — display only (amount stays in wei). Defaults to 18. */
  decimals?: number
  /** Token symbol — display only (e.g. 'tUSDT'). */
  symbol?: string
  /** WalletConnect project ID (optional — enables the WalletConnect connector). */
  wcProjectId?: string
  /** Called when payment is confirmed on-chain. */
  onSuccess?: (order: OrderStatus) => void
  /** Called on any error (wallet rejection, tx failure, poll timeout). */
  onError?: (err: Error) => void
}

/** Options passed to BeamPay.init() / new BeamPayCheckout(). */
export type CheckoutInit = OrderSource & DisplayOpts

/**
 * A signed order in the viem-typed shape the on-chain layer submits. Produced
 * from an OrderEnvelope by `toPayableOrder()`.
 */
export interface PayableOrder {
  chain: ChainKey
  merchant: Address
  receiver: Address
  token: Address
  amount: string
  orderId: Hex
  signer: Address
  createdAt: number
  expiresAt: number
  signature: Hex
}

/** On-chain / API order status */
export type OrderState = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'

export interface OrderStatus {
  /** Contract event orderId (merchant-chosen bytes32) — the on-chain pay/refund param. */
  orderId: Hex
  chain: string
  merchant: Address
  token: Address
  amount: string
  payer?: Address
  state: OrderState
  txHash?: Hex
  /** Unix ms timestamp when status was last updated */
  updatedAt: number
}
