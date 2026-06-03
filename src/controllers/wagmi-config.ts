import { injected, walletConnect } from '@wagmi/connectors'
import { http, type Config, createConfig, fallback } from '@wagmi/core'
import { bsc, bscTestnet, mainnet } from 'viem/chains'

// Multiple public endpoints per chain. fallback() auto-fails-over on error and
// (rank:true) re-orders by live latency, so a flaky node never blocks reads.
// Default viem RPC (binance seed nodes) is unreliable — these are pinned instead.
const RPCS: Record<number, string[]> = {
  [bsc.id]: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.bnbchain.org'],
  [bscTestnet.id]: [
    'https://bsc-testnet-rpc.publicnode.com',
    'https://bsc-testnet.drpc.org',
    'https://api.zan.top/bsc-testnet',
  ],
  [mainnet.id]: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
}

function transport(chainId: number) {
  const urls = RPCS[chainId] ?? []
  return fallback(
    urls.map((url) => http(url, { timeout: 8_000, retryCount: 2 })),
    { rank: true },
  )
}

export function createWagmiConfig(wcProjectId?: string): Config {
  const connectors = [
    // EIP-6963 native wallet discovery — auto-detects MetaMask, Rabby, etc.
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ]
  return createConfig({
    chains: [bsc, bscTestnet, mainnet],
    transports: {
      [bsc.id]: transport(bsc.id),
      [bscTestnet.id]: transport(bscTestnet.id),
      [mainnet.id]: transport(mainnet.id),
    },
    connectors,
  })
}

export type WagmiConfig = Config

let cached: Config | undefined
let cachedKey: string | undefined

/**
 * Single shared wagmi Config per widget instance. Re-created only when the
 * WalletConnect project id changes (multiple mounts on a page share one config).
 */
export function getWagmiConfig(wcProjectId?: string): Config {
  const key = wcProjectId ?? ''
  if (!cached || cachedKey !== key) {
    cached = createWagmiConfig(wcProjectId)
    cachedKey = key
  }
  return cached
}
