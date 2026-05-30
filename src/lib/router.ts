import { BEAM_PAY_ROUTER_ADDRESSES, BeamPayRouterAbi } from '@beampay/contracts-abi'
import { readContract } from '@wagmi/core'
import type { Config } from '@wagmi/core'
import type { Address, Hex } from 'viem'
import { type ChainKey, isNativeAddress } from '../chains'
import type { BeamPayCheckoutOptions } from '../types'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const

export function getRouterAddress(chain: ChainKey): Address {
  const addr = BEAM_PAY_ROUTER_ADDRESSES[chain] as Address | undefined
  if (!addr || addr === ZERO_ADDR) {
    throw new Error(`BeamPayRouter address for ${chain} is not configured`)
  }
  return addr
}

/** Minimal ERC-20 surface the widget needs (allowance + approve). */
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/**
 * Build the `pay()` write request from a signed-order envelope. Mirrors the
 * deployed signature: pay(merchant, receiver, token, amount, orderId, signer,
 * createdAt, expiresAt, signature). Native path attaches msg.value = amount.
 */
export function buildPayRequest(chain: ChainKey, opts: BeamPayCheckoutOptions) {
  const amount = BigInt(opts.amount)
  const isNative = isNativeAddress(opts.token)
  return {
    address: getRouterAddress(chain),
    abi: BeamPayRouterAbi,
    functionName: 'pay' as const,
    args: [
      opts.merchant,
      opts.receiver,
      opts.token,
      amount,
      opts.orderId,
      opts.signer,
      BigInt(opts.createdAt),
      BigInt(opts.expiresAt),
      opts.signature,
    ] as const,
    value: isNative ? amount : 0n,
  }
}

export function buildApproveRequest(chain: ChainKey, token: Address, amount: bigint) {
  return {
    address: token,
    abi: erc20Abi,
    functionName: 'approve' as const,
    args: [getRouterAddress(chain), amount] as const,
  }
}

export async function readAllowance(
  config: Config,
  chain: ChainKey,
  token: Address,
  owner: Address,
): Promise<bigint> {
  return (await readContract(config, {
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, getRouterAddress(chain)],
  })) as bigint
}

/**
 * Read the on-chain order record. `payer != 0x0` means the order has been paid
 * — the widget polls this after submitting `pay()` rather than calling a backend.
 */
export async function readOrderPayer(
  config: Config,
  chain: ChainKey,
  merchant: Address,
  orderId: Hex,
): Promise<Address> {
  const record = (await readContract(config, {
    address: getRouterAddress(chain),
    abi: BeamPayRouterAbi,
    functionName: 'getOrder',
    args: [merchant, orderId],
  })) as { payer: Address }
  return record.payer
}

export function isPaid(payer: Address): boolean {
  return payer.toLowerCase() !== ZERO_ADDR
}
