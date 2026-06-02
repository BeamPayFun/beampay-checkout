import type { Address, Hex } from 'viem'

/**
 * Options passed to BeamPay.init() / new BeamPayCheckout().
 *
 * Carries a full v1.4 signed order — the merchant (or a delegate) signs the
 * EIP-712 Order off-chain (e.g. via beampay-web /create) and the resulting
 * envelope is handed to the widget. The widget never signs; it only submits
 * the user's `pay()` transaction.
 */
export interface BeamPayCheckoutOptions {
  /** Chain key: 'bsc' | 'ethereum' | 'bsc-testnet'. */
  chain: string
  /** Order owner — order-key namespace, event index, refund caller. */
  merchant: Address
  /** v1.4 signed payout destination — may differ from `merchant`. */
  receiver: Address
  /** Token contract address, or NATIVE_TOKEN sentinel for BNB/ETH. */
  token: Address
  /** Amount in token base units (wei), as a decimal string. */
  amount: string
  /** Merchant-scoped unique 32-byte order id (hex). */
  orderId: Hex
  /** EIP-712 signer recovered on-chain (merchant or merchant's delegate). */
  signer: Address
  /** Order creation timestamp, unix seconds (uint64). */
  createdAt: number
  /** Order expiry timestamp, unix seconds (uint64). */
  expiresAt: number
  /** 65-byte EIP-712 signature, hex-encoded. */
  signature: Hex
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

/** Back-compat alias — elements import `CheckoutOptions`. */
export type CheckoutOptions = BeamPayCheckoutOptions

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
