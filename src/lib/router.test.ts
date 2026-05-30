// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { NATIVE_TOKEN } from '../chains'
import type { BeamPayCheckoutOptions } from '../types'
import { buildPayRequest, isPaid } from './router'

const base: BeamPayCheckoutOptions = {
  chain: 'bsc-testnet',
  merchant: '0x1111111111111111111111111111111111111111',
  receiver: '0x2222222222222222222222222222222222222222',
  token: '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c',
  amount: '1500000',
  orderId: '0xabc0000000000000000000000000000000000000000000000000000000000001',
  signer: '0x3333333333333333333333333333333333333333',
  createdAt: 1_717_000_000,
  expiresAt: 1_717_086_400,
  signature: '0xdeadbeef',
}

describe('buildPayRequest', () => {
  it('emits pay() args in the exact contract order', () => {
    const req = buildPayRequest('bsc-testnet', base)
    expect(req.functionName).toBe('pay')
    // pay(merchant, receiver, token, amount, orderId, signer, createdAt, expiresAt, signature)
    expect(req.args).toEqual([
      base.merchant,
      base.receiver,
      base.token,
      1_500_000n,
      base.orderId,
      base.signer,
      1_717_000_000n,
      1_717_086_400n,
      base.signature,
    ])
  })

  it('attaches no msg.value on the ERC-20 path', () => {
    expect(buildPayRequest('bsc-testnet', base).value).toBe(0n)
  })

  it('attaches msg.value === amount on the native path', () => {
    const req = buildPayRequest('bsc-testnet', { ...base, token: NATIVE_TOKEN })
    expect(req.value).toBe(1_500_000n)
  })
})

describe('isPaid', () => {
  it('is false for the zero address, true otherwise', () => {
    expect(isPaid('0x0000000000000000000000000000000000000000')).toBe(false)
    expect(isPaid('0x2222222222222222222222222222222222222222')).toBe(true)
  })
})
