import { connect, switchChain, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { type Address, type Hex, formatUnits, isAddress, parseUnits } from 'viem'
import { chainId } from '../src/chains'
import { getWagmiConfig } from '../src/controllers/wagmi-config'
import { BeamPay } from '../src/index'
import type { BeamPayCheckoutOptions } from '../src/types'

// --- BSC testnet demo constants -------------------------------------------
const TUSDT = '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c' as Address
const TUSDT_DECIMALS = 6
const TUSDT_SYMBOL = 'tUSDT'
const CHAIN = 'bsc-testnet' as const
const CREATE_URL = (import.meta.env.VITE_CREATE_URL as string) ?? 'http://localhost:3002/create'

const faucetAbi = [
  {
    type: 'function',
    name: 'faucet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

const config = getWagmiConfig()

// --- Cart ------------------------------------------------------------------
interface Product {
  id: string
  name: string
  price: string // tUSDT, human units
}
const PRODUCTS: Product[] = [
  { id: 'mug', name: 'Beam Mug', price: '4.5' },
  { id: 'tee', name: 'Beam T-Shirt', price: '12' },
  { id: 'hoodie', name: 'Beam Hoodie', price: '29' },
]
const qty: Record<string, number> = { mug: 1, tee: 0, hoodie: 0 }

function totalUnits(): number {
  return PRODUCTS.reduce((sum, p) => sum + Number(p.price) * qty[p.id], 0)
}
function totalWei(): bigint {
  return parseUnits(totalUnits().toFixed(TUSDT_DECIMALS), TUSDT_DECIMALS)
}

// --- DOM -------------------------------------------------------------------
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

function renderProducts() {
  const root = $('#products')
  root.innerHTML = ''
  for (const p of PRODUCTS) {
    const row = document.createElement('div')
    row.className = 'product'
    row.innerHTML = `
      <span>${p.name} <span style="color:#6b7280">· ${p.price} ${TUSDT_SYMBOL}</span></span>
      <span class="qty">
        <button data-dec="${p.id}">−</button>
        <span id="q-${p.id}">${qty[p.id]}</span>
        <button data-inc="${p.id}">+</button>
      </span>`
    root.appendChild(row)
  }
  for (const b of Array.from(root.querySelectorAll('button[data-inc]'))) {
    b.addEventListener('click', () => {
      qty[(b as HTMLElement).dataset.inc as string]++
      refresh()
    })
  }
  for (const b of Array.from(root.querySelectorAll('button[data-dec]'))) {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.dec as string
      qty[id] = Math.max(0, qty[id] - 1)
      refresh()
    })
  }
}

function refresh() {
  for (const p of PRODUCTS) $(`#q-${p.id}`).textContent = String(qty[p.id])
  $('#total').textContent = `${totalUnits()} ${TUSDT_SYMBOL}`
  updateCreateLink()
}

function updateCreateLink() {
  const merchant = ($('#merchant') as HTMLInputElement).value.trim()
  const sp = new URLSearchParams({
    chain: CHAIN,
    token: TUSDT,
    amount: totalWei().toString(),
  })
  if (isAddress(merchant)) sp.set('merchant', merchant)
  ;($('#createlink') as HTMLAnchorElement).href = `${CREATE_URL}?${sp.toString()}`
}

function setStatus(msg: string, cls = '') {
  const el = $('#status')
  el.textContent = msg
  el.className = cls
}

// --- Faucet ----------------------------------------------------------------
async function runFaucet() {
  const btn = $('#faucet') as HTMLButtonElement
  btn.disabled = true
  try {
    setStatus('Connecting wallet…')
    const injected = config.connectors.find((c) => c.type === 'injected')
    if (!injected) throw new Error('No injected wallet found')
    await connect(config, { connector: injected })
    await switchChain(config, { chainId: chainId(CHAIN) })
    setStatus('Minting 100 tUSDT…')
    const hash = await writeContract(config, {
      address: TUSDT,
      abi: faucetAbi,
      functionName: 'faucet',
      args: [parseUnits('100', TUSDT_DECIMALS)],
      chainId: chainId(CHAIN),
    })
    await waitForTransactionReceipt(config, { hash, chainId: chainId(CHAIN) })
    setStatus('Minted 100 tUSDT ✓', 'ok')
  } catch (err) {
    setStatus(`Faucet failed: ${err instanceof Error ? err.message : String(err)}`, 'bad')
  } finally {
    btn.disabled = false
  }
}

// --- Parse a beampay-web pay link into widget options ----------------------
function parsePayLink(raw: string): BeamPayCheckoutOptions {
  const url = new URL(raw.trim())
  const q = url.searchParams
  const need = (k: string): string => {
    const v = q.get(k)
    if (!v) throw new Error(`pay link missing "${k}"`)
    return v
  }
  const token = need('token') as Address
  const isUsdt = token.toLowerCase() === TUSDT.toLowerCase()
  return {
    chain: need('chain'),
    merchant: need('merchant') as Address,
    receiver: need('receiver') as Address,
    token,
    amount: need('amount'),
    orderId: need('orderId') as Hex,
    signer: need('signer') as Address,
    createdAt: Number(need('createdAt')),
    expiresAt: Number(need('expiresAt')),
    signature: need('sig') as Hex,
    decimals: isUsdt ? TUSDT_DECIMALS : 18,
    symbol: isUsdt ? TUSDT_SYMBOL : undefined,
  }
}

function loadOrder() {
  const raw = ($('#paylink') as HTMLTextAreaElement).value
  let opts: BeamPayCheckoutOptions
  try {
    opts = parsePayLink(raw)
  } catch (err) {
    setStatus(`Invalid pay link: ${err instanceof Error ? err.message : String(err)}`, 'bad')
    return
  }
  const decimals = opts.decimals ?? 18
  setStatus(
    `Order loaded: ${formatUnits(BigInt(opts.amount), decimals)} ${opts.symbol ?? ''} → ${opts.receiver}`,
  )

  // Fresh mount target each time (mount() replaces the node it's given).
  const row = $('.pay-row')
  row.innerHTML = '<div id="pay"></div>'
  BeamPay.init({
    ...opts,
    onSuccess: (order) => setStatus(`Paid ✓  tx: ${order.txHash}`, 'ok'),
    onError: (e) => setStatus(`Payment error: ${e.message}`, 'bad'),
  }).mount('#pay')
}

// --- Wire up ---------------------------------------------------------------
renderProducts()
refresh()
$('#faucet').addEventListener('click', runFaucet)
$('#load').addEventListener('click', loadOrder)
$('#merchant').addEventListener('input', updateCreateLink)
