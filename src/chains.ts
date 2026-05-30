import type { Chain } from 'viem'
import { bsc, bscTestnet, mainnet } from 'viem/chains'

/** Chain keys accepted in BeamPayCheckoutOptions.chain — mirrors beampay-web. */
export type ChainKey = 'bsc' | 'ethereum' | 'bsc-testnet'

export const SUPPORTED_CHAINS: Record<ChainKey, Chain> = {
  bsc,
  ethereum: mainnet,
  'bsc-testnet': bscTestnet,
}

export const CHAIN_ID_TO_KEY: Record<number, ChainKey> = {
  [bsc.id]: 'bsc',
  [mainnet.id]: 'ethereum',
  [bscTestnet.id]: 'bsc-testnet',
}

const EXPLORER_TX: Record<ChainKey, (hash: string) => string> = {
  bsc: (h) => `https://bscscan.com/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  'bsc-testnet': (h) => `https://testnet.bscscan.com/tx/${h}`,
}

export function isChainKey(v: string): v is ChainKey {
  return v === 'bsc' || v === 'ethereum' || v === 'bsc-testnet'
}

export function chainId(chain: ChainKey): number {
  return SUPPORTED_CHAINS[chain].id
}

export function explorerTxUrl(chain: ChainKey, hash: string): string {
  return EXPLORER_TX[chain](hash)
}

/** Sentinel for the chain's native asset (BNB / ETH). */
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const

export function isNativeAddress(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN.toLowerCase()
}
