import { injected, walletConnect } from '@wagmi/connectors'
import { http, type Config, createConfig, fallback } from '@wagmi/core'
import { bsc, bscTestnet, mainnet } from 'viem/chains'

export function createWagmiConfig(wcProjectId?: string): Config {
  const connectors = [
    // EIP-6963 native wallet discovery — auto-detects MetaMask, Rabby, etc.
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
  ]
  return createConfig({
    chains: [bsc, bscTestnet, mainnet],
    transports: {
      [bsc.id]: fallback([http()]),
      [bscTestnet.id]: fallback([http()]),
      [mainnet.id]: fallback([http()]),
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
