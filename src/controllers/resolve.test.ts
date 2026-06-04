// @vitest-environment node
import type { OrderEnvelope } from '@beampay/schemas'
import { describe, expect, it } from 'vitest'
import { parsePayLink, resolveOrder, toPayableOrder } from './resolve'

const env: OrderEnvelope = {
  chain: 'bsc-testnet',
  merchant: `0x${'1'.repeat(40)}`,
  receiver: `0x${'2'.repeat(40)}`,
  token: `0x${'3'.repeat(40)}`,
  amount: '1500000',
  orderId: `0x${'a'.repeat(64)}`,
  feeBps: 0,
  signer: `0x${'1'.repeat(40)}`,
  createdAt: 1_717_000_000,
  expiresAt: 1_717_003_600,
  signature: `0x${'b'.repeat(130)}`,
  isDelegate: false,
}

function buildLink(e: OrderEnvelope): string {
  const q = new URLSearchParams({
    chain: e.chain,
    merchant: e.merchant,
    receiver: e.receiver,
    token: e.token,
    amount: e.amount,
    orderId: e.orderId,
    signer: e.signer,
    createdAt: String(e.createdAt),
    expiresAt: String(e.expiresAt),
    sig: e.signature,
    feeBps: String(e.feeBps),
  })
  return `https://app.beampay.fun/pay?${q.toString()}`
}

describe('parsePayLink', () => {
  it('round-trips a flat-query pay link into a valid envelope', () => {
    const parsed = parsePayLink(buildLink(env))
    expect(parsed.merchant).toBe(env.merchant)
    expect(parsed.amount).toBe(env.amount)
    expect(parsed.signature).toBe(env.signature)
    expect(parsed.chain).toBe('bsc-testnet')
  })

  it('accepts a bare query string and defaults receiver to merchant', () => {
    const parsed = parsePayLink(
      `chain=bsc-testnet&merchant=${env.merchant}&token=${env.token}&amount=1&orderId=${env.orderId}&signer=${env.signer}&createdAt=1&expiresAt=2&sig=${env.signature}`,
    )
    expect(parsed.receiver).toBe(env.merchant)
  })

  it('rejects a link missing the signature', () => {
    expect(() => parsePayLink(`chain=bsc-testnet&merchant=${env.merchant}&amount=1`)).toThrow()
  })
})

describe('resolveOrder', () => {
  it('Mode A — validates an inline order', async () => {
    expect((await resolveOrder({ order: env })).orderId).toBe(env.orderId)
  })

  it('Mode B — parses a link', async () => {
    expect((await resolveOrder({ link: buildLink(env) })).amount).toBe(env.amount)
  })

  it('Mode C — awaits createOrder', async () => {
    expect((await resolveOrder({ createOrder: async () => env })).signer).toBe(env.signer)
  })
})

describe('toPayableOrder', () => {
  it('maps an envelope to the viem-typed payable shape', () => {
    const p = toPayableOrder(env)
    expect(p.chain).toBe('bsc-testnet')
    expect(p.amount).toBe('1500000')
    expect(p.signature).toBe(env.signature)
  })

  it('throws on an unsupported chain', () => {
    expect(() => toPayableOrder({ ...env, chain: 'solana' } as unknown as OrderEnvelope)).toThrow()
  })
})
