import type { Hex } from 'viem'
/**
 * Thin API wrapper around @beam/sdk.
 *
 * TODO: replace typed-fetch stub with full @beam/sdk client once workspace is
 * set up and @beam/sdk is published. For v1, we call beam-api directly via
 * fetch to query order status.
 */
import type { OrderState, OrderStatus } from '../types.js'

interface RawOrderResponse {
  code: number
  msg: string
  data: {
    orderKey: string
    chain: string
    merchant: string
    token: string
    amount: string
    payer?: string
    status: string
    txHash?: string
    updatedAt: number
  } | null
}

function mapState(raw: string): OrderState {
  const map: Record<string, OrderState> = {
    pending: 'pending',
    paid: 'paid',
    failed: 'failed',
    expired: 'expired',
    refunded: 'refunded',
  }
  return map[raw] ?? 'pending'
}

export async function fetchOrderStatus(
  apiUrl: string,
  chain: string,
  orderKey: Hex,
): Promise<OrderStatus | null> {
  const url = `${apiUrl}/v1/payment/order?chain=${encodeURIComponent(chain)}&orderKey=${encodeURIComponent(orderKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`BeamPay API error: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as RawOrderResponse
  if (json.code !== 0 || !json.data) return null

  const d = json.data
  return {
    orderKey: d.orderKey as Hex,
    chain: d.chain,
    merchant: d.merchant as `0x${string}`,
    token: d.token as `0x${string}`,
    amount: d.amount,
    ...(d.payer ? { payer: d.payer as `0x${string}` } : {}),
    state: mapState(d.status),
    ...(d.txHash ? { txHash: d.txHash as Hex } : {}),
    updatedAt: d.updatedAt,
  }
}
