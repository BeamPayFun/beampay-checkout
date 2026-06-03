import { type OrderEnvelope, OrderEnvelopeSchema } from '@beampay/schemas'
import type { Address, Hex } from 'viem'
import { type ChainKey, isChainKey } from '../chains'
import type { OrderSource, PayableOrder } from '../types'

/**
 * Resolve an OrderSource into a validated, signed OrderEnvelope.
 *
 * - Mode A (`order`)       — validate the inline envelope.
 * - Mode B (`link`)        — parse a beampay-web flat-query pay link.
 * - Mode C (`createOrder`) — call the merchant backend (at pay time), then validate.
 */
export async function resolveOrder(source: OrderSource): Promise<OrderEnvelope> {
  if ('order' in source) return OrderEnvelopeSchema.parse(source.order)
  if ('link' in source) return parsePayLink(source.link)
  if ('createOrder' in source) return OrderEnvelopeSchema.parse(await source.createOrder())
  throw new Error('BeamPay: invalid order source')
}

/**
 * Parse a beampay-web pay link into a signed OrderEnvelope. Accepts a full href
 * or a bare query string. The link is the SAME flat-query format `/create`
 * emits and `/pay` reads (`?chain=…&merchant=…&sig=…`) — one link format across
 * the workspace.
 */
export function parsePayLink(input: string): OrderEnvelope {
  const query = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input
  const p = new URLSearchParams(query)

  const merchant = p.get('merchant') ?? ''
  const sig = p.get('sig') ?? p.get('signature')
  const candidate = {
    chain: p.get('chain'),
    merchant,
    // `/pay` defaults an unsigned receiver to merchant; a signed link carries it.
    receiver: p.get('receiver') ?? merchant,
    token: p.get('token'),
    amount: p.get('amount'),
    orderId: p.get('orderId'),
    feeBps: p.get('feeBps') ? Number(p.get('feeBps')) : 0,
    signer: p.get('signer'),
    createdAt: p.get('createdAt') ? Number(p.get('createdAt')) : undefined,
    expiresAt: p.get('expiresAt') ? Number(p.get('expiresAt')) : undefined,
    signature: sig,
    isDelegate: false,
    ...(p.get('memo') ? { memo: p.get('memo') } : {}),
  }
  return OrderEnvelopeSchema.parse(candidate)
}

/** Convert a validated envelope into the viem-typed shape the on-chain layer submits. */
export function toPayableOrder(env: OrderEnvelope): PayableOrder {
  if (!isChainKey(env.chain)) throw new Error(`BeamPay: unsupported chain: ${env.chain}`)
  const chain: ChainKey = env.chain
  return {
    chain,
    merchant: env.merchant as Address,
    receiver: env.receiver as Address,
    token: env.token as Address,
    amount: env.amount,
    orderId: env.orderId as Hex,
    signer: env.signer as Address,
    createdAt: env.createdAt,
    expiresAt: env.expiresAt,
    signature: env.signature as Hex,
  }
}
