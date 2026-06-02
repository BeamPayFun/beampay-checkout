import {
  type Config,
  getAccount,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { bsc, bscTestnet, mainnet } from 'viem/chains'
import { type ChainKey, isChainKey, isNativeAddress } from '../chains'
import {
  buildApproveRequest,
  buildPayRequest,
  isPaid,
  readAllowance,
  readOrderPayer,
} from '../lib/router'
import type { CheckoutOptions, OrderStatus } from '../types'
import { getWagmiConfig } from './wagmi-config'

export type PayStep = 'switching' | 'approving' | 'confirming' | 'pending'

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 60_000

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** viem chain object per key — `.id` is a literal, satisfying wagmi's switchChain typing. */
const VIEM_CHAIN = { bsc, ethereum: mainnet, 'bsc-testnet': bscTestnet } as const

/**
 * Drive a full signed-order payment to completion:
 * ensure-connected → switch chain → (approve if ERC-20) → pay → wait receipt →
 * poll getOrder() until payer is set. Returns the confirmed OrderStatus.
 */
export async function runPayment(
  config: Config,
  opts: CheckoutOptions,
  onStep: (step: PayStep) => void,
): Promise<OrderStatus> {
  if (!isChainKey(opts.chain)) {
    throw new Error(`Unsupported chain: ${opts.chain}`)
  }
  const chain: ChainKey = opts.chain
  const target = VIEM_CHAIN[chain]
  const amount = BigInt(opts.amount)

  const account = getAccount(config)
  if (!account.address) throw new Error('Wallet not connected')
  const owner = account.address

  if (account.chainId !== target.id) {
    onStep('switching')
    await switchChain(config, { chainId: target.id })
  }

  if (!isNativeAddress(opts.token)) {
    const allowance = await readAllowance(config, chain, opts.token, owner)
    if (allowance < amount) {
      onStep('approving')
      const approveHash = await writeContract(
        config,
        buildApproveRequest(chain, opts.token, amount),
      )
      await waitForTransactionReceipt(config, { hash: approveHash })
    }
  }

  onStep('confirming')
  const txHash = await writeContract(config, buildPayRequest(chain, opts))

  onStep('pending')
  await waitForTransactionReceipt(config, { hash: txHash })

  // Poll on-chain order state — no backend.
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let payer = await readOrderPayer(config, chain, opts.merchant, opts.orderId)
  while (!isPaid(payer) && Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS)
    payer = await readOrderPayer(config, chain, opts.merchant, opts.orderId)
  }
  if (!isPaid(payer)) {
    throw new Error('Payment submitted but order not confirmed on-chain (timeout)')
  }

  return {
    orderId: opts.orderId,
    chain,
    merchant: opts.merchant,
    token: opts.token,
    amount: opts.amount,
    payer,
    state: 'paid',
    txHash,
    updatedAt: Date.now(),
  }
}

export class BeamPayCheckout {
  private opts: CheckoutOptions
  private root: HTMLElement | null = null
  readonly config: Config

  constructor(opts: CheckoutOptions) {
    this.opts = opts
    this.config = getWagmiConfig(opts.wcProjectId)
  }

  mount(selector: string | HTMLElement): this {
    this.root = typeof selector === 'string' ? document.querySelector(selector) : selector

    if (!this.root) throw new Error(`BeamPay: element not found: ${selector}`)

    // Ensure custom elements are registered
    import('../elements/pay-button')
    import('../elements/pay-modal')

    const button = document.createElement('beam-pay-button') as HTMLElement & {
      opts?: CheckoutOptions
    }
    button.opts = this.opts
    button.addEventListener('beam-pay-click', () => this.openModal())
    this.root.replaceWith(button)
    this.root = button

    return this
  }

  private openModal() {
    const modal = document.createElement('beam-pay-modal') as HTMLElement & {
      opts?: CheckoutOptions
      config?: Config
    }
    modal.opts = this.opts
    modal.config = this.config
    modal.addEventListener('beam-pay-success', (e: Event) => {
      this.opts.onSuccess?.((e as CustomEvent<OrderStatus>).detail)
      modal.remove()
    })
    modal.addEventListener('beam-pay-error', (e: Event) => {
      this.opts.onError?.((e as CustomEvent<Error>).detail)
      modal.remove()
    })
    modal.addEventListener('beam-pay-close', () => modal.remove())
    document.body.appendChild(modal)
  }
}
