import {
  connect,
  getAccount,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { type Address, parseUnits } from 'viem'
import { chainId } from '../src/chains'
import { getWagmiConfig } from '../src/controllers/wagmi-config'
import { BeamPay, type OrderEnvelope } from '../src/index'

// --- BSC testnet demo constants -------------------------------------------
const TUSDT = '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c' as Address
const TUSDT_DECIMALS = 6
const TUSDT_SYMBOL = 'tUSDT'
const CHAIN = 'bsc-testnet' as const
// Demo merchant = the demo-signer's own burner address (signer == merchant == receiver).
const MERCHANT = '0x5ec880094B0A166ba305f7CC9eA1AB519b70a626' as Address

// Self-hosted merchant signer (see examples/demo-signer in beampay-libs).
// Deployed at demo-signer.beampay.fun; for a local signer set VITE_SIGNER_URL=http://localhost:8787.
const SIGNER_URL = import.meta.env.VITE_SIGNER_URL ?? 'https://demo-signer.beampay.fun'

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

// --- i18n ------------------------------------------------------------------
type Lang = 'en' | 'zh'
let lang: Lang = 'en'

type Entry = { en: string; zh: string } | { en: (a: string) => string; zh: (a: string) => string }
const STR: Record<string, Entry> = {
  tagline: { en: 'BeamPay Checkout demo · BSC Testnet', zh: 'BeamPay Checkout 演示 · BSC 测试网' },
  cart: { en: 'Cart', zh: '购物车' },
  total: { en: 'Total', zh: '合计' },
  faucet: { en: 'Get test tUSDT', zh: '领取测试 tUSDT' },
  faucet_hint: {
    en: 'Mints mock tUSDT to your wallet so you can pay.',
    zh: '铸造 mock tUSDT 到钱包以便支付。',
  },
  faucet_bnb: { en: 'Get tBNB (gas) ↗', zh: '领取 tBNB（gas）↗' },
  modes_title: { en: 'Choose integration mode', zh: '选择集成模式' },
  mA_ttl: { en: 'Pay link', zh: '支付链接' },
  mA_sub: { en: 'Share / invoice / QR', zh: '分享 / 发票 / 二维码' },
  mB_ttl: { en: 'Inline', zh: '内联' },
  mB_sub: { en: 'Own site, fixed price', zh: '自有站，定价固定' },
  mC_ttl: { en: 'Callback', zh: '回调' },
  mC_sub: { en: 'Cart, dynamic price', zh: '购物车，动态价' },
  no_backend: { en: 'no backend at pay time', zh: '支付时无需后端' },
  needs_backend: { en: 'needs /sign backend', zh: '需 /sign 后端' },
  pay_title: { en: 'Pay', zh: '支付' },
  hint_A: {
    en: 'Push: the merchant signs once, packs the envelope into a flat-query pay link, and shares it. BeamPay.fromLink(href) parses it — no backend for the payer.',
    zh: 'Push：商户签一次，把 envelope 打包进扁平 query 支付链接并分享。BeamPay.fromLink(href) 解析它——付款方无需后端。',
  },
  hint_B: {
    en: 'Push: the merchant pre-signs a fixed-price order server-side and hands the envelope straight to BeamPay.init({ order }). The cart is locked.',
    zh: 'Push：商户在后端对固定价订单预签名，把 envelope 直接传给 BeamPay.init({ order })。购物车已锁定。',
  },
  hint_C: {
    en: 'Pull: edit the cart, then click Pay. BeamPay calls createOrder() → your /sign backend computes the price and signs on demand. The buyer wallet only signs pay().',
    zh: 'Pull：修改购物车后点支付。BeamPay 调 createOrder() → 你的 /sign 后端按需算价并签名。买家钱包只签 pay()。',
  },
  st_connecting: { en: 'Connecting wallet…', zh: '连接钱包…' },
  st_minting: { en: 'Minting 100 tUSDT…', zh: '铸造 100 tUSDT…' },
  st_minted: { en: 'Minted 100 tUSDT ✓', zh: '已铸造 100 tUSDT ✓' },
  st_faucet_fail: { en: (e) => `Faucet failed: ${e}`, zh: (e) => `领取失败: ${e}` },
  st_cart_empty: { en: 'Cart is empty — add an item first.', zh: '购物车为空，请先加购商品。' },
  st_signing: { en: 'Merchant backend signing order…', zh: '商户后端签署订单中…' },
  st_signer_fail: { en: (e) => `Signer error: ${e}`, zh: (e) => `签名器错误: ${e}` },
  st_ready_A: { en: 'Pay link generated — click Pay.', zh: '支付链接已生成——点击支付。' },
  st_ready_B: { en: 'Pre-signed order ready — click Pay.', zh: '预签名订单就绪——点击支付。' },
  st_ready_C: { en: 'Edit the cart, then click Pay.', zh: '修改购物车后点击支付。' },
  st_paid: { en: (tx) => `Paid ✓  tx: ${tx}`, zh: (tx) => `支付成功 ✓  tx: ${tx}` },
  st_pay_error: { en: (m) => `Payment error: ${m}`, zh: (m) => `支付错误: ${m}` },
}

function t(key: string, arg = ''): string {
  const v = STR[key]?.[lang]
  if (v === undefined) return key
  return typeof v === 'function' ? v(arg) : v
}

// --- Cart ------------------------------------------------------------------
interface Product {
  id: string
  name: string
  price: string // tUSDT, human units (mirrors the signer catalog)
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
}

// Cart is editable only in Mode C (dynamic price). Push modes lock it.
function setCartLocked(locked: boolean) {
  for (const b of Array.from($('#products').querySelectorAll('button'))) {
    ;(b as HTMLButtonElement).disabled = locked
  }
}

// Status stored by key (+ arg) so it re-translates on language toggle.
let lastStatus: { key: string; arg: string; cls: string } | null = null
function setStatus(key: string | null, arg = '', cls = '') {
  lastStatus = key ? { key, arg, cls } : null
  renderStatus()
}
function renderStatus() {
  const el = $('#status')
  el.textContent = lastStatus ? t(lastStatus.key, lastStatus.arg) : ''
  el.className = lastStatus?.cls ?? ''
}

// --- Faucet ----------------------------------------------------------------
async function runFaucet() {
  const btn = $('#faucet') as HTMLButtonElement
  btn.disabled = true
  try {
    setStatus('st_connecting')
    await ensureWallet()
    setStatus('st_minting')
    const hash = await writeContract(config, {
      address: TUSDT,
      abi: faucetAbi,
      functionName: 'faucet',
      args: [parseUnits('100', TUSDT_DECIMALS)],
      chainId: chainId(CHAIN),
    })
    await waitForTransactionReceipt(config, { hash, chainId: chainId(CHAIN) })
    setStatus('st_minted', '', 'ok')
  } catch (err) {
    setStatus('st_faucet_fail', err instanceof Error ? err.message : String(err), 'bad')
  } finally {
    btn.disabled = false
  }
}

async function ensureWallet(): Promise<Address> {
  let acct = getAccount(config)
  if (!acct.isConnected) {
    const injected = config.connectors.find((c) => c.type === 'injected')
    if (!injected) throw new Error('No injected wallet found')
    await connect(config, { connector: injected })
    acct = getAccount(config)
  }
  await switchChain(config, { chainId: chainId(CHAIN) })
  const addr = getAccount(config).address
  if (!addr) throw new Error('Wallet not connected')
  return addr
}

// --- Merchant signer (self-hosted backend) ---------------------------------
// The merchant frontend computes the order amount and posts the order fields
// (amount, token, merchant, receiver) to its own signer.
// Push (A/B) call this ahead of time; pull (C) calls it at pay time.
function cartAmount(): bigint {
  return PRODUCTS.reduce(
    (sum, p) => sum + parseUnits(p.price, TUSDT_DECIMALS) * BigInt(qty[p.id]),
    0n,
  )
}

async function signViaBackend(): Promise<OrderEnvelope> {
  const amount = cartAmount()
  if (amount <= 0n) throw new Error('empty cart')
  const res = await fetch(`${SIGNER_URL}/sign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: amount.toString(),
      token: TUSDT,
      merchant: MERCHANT,
      receiver: MERCHANT,
    }),
  })
  const json = (await res.json().catch(() => null)) as {
    code: string
    msg: string
    data: OrderEnvelope | null
  } | null
  if (!res.ok || json?.code !== '000000000' || !json.data) {
    throw new Error(json?.msg ?? `signer ${res.status}`)
  }
  return json.data
}

// Pack an envelope into the same flat-query pay link beampay-web /create emits.
function buildPayLink(env: OrderEnvelope): string {
  const q = new URLSearchParams({
    chain: env.chain,
    merchant: env.merchant,
    receiver: env.receiver,
    token: env.token,
    amount: env.amount,
    orderId: env.orderId,
    signer: env.signer,
    createdAt: String(env.createdAt),
    expiresAt: String(env.expiresAt),
    sig: env.signature,
    feeBps: String(env.feeBps),
  })
  return `https://app.beampay.fun/pay?${q.toString()}`
}

// --- Mode handling ---------------------------------------------------------
type Mode = 'A' | 'B' | 'C'
let mode: Mode = 'C'

const DISPLAY = { decimals: TUSDT_DECIMALS, symbol: TUSDT_SYMBOL }

function resetPayArea() {
  $('.pay-row').innerHTML = '<div id="pay"></div>'
  const link = $('#paylink')
  link.classList.add('empty')
  link.innerHTML = ''
}

function mountCommon(source: Parameters<typeof BeamPay.init>[0]) {
  resetPayArea()
  BeamPay.init({
    ...source,
    ...DISPLAY,
    onSuccess: (order) => setStatus('st_paid', order.txHash ?? '', 'ok'),
    onError: (e) => setStatus('st_pay_error', e.message, 'bad'),
  }).mount('#pay')
}

async function selectMode(next: Mode) {
  mode = next
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.mode'))) {
    el.classList.toggle('sel', el.dataset.mode === mode)
  }
  $('#mode-hint').textContent = t(`hint_${mode}`)
  resetPayArea()
  setCartLocked(mode !== 'C')

  if (mode === 'C') {
    // Pull: sign on demand at pay time with the live cart.
    setStatus('st_ready_C')
    mountCommon({ createOrder: () => signViaBackend() })
    return
  }

  // Push (A / B): pre-sign the current cart now.
  if (totalUnits() <= 0) {
    setStatus('st_cart_empty', '', 'bad')
    return
  }
  setStatus('st_signing')
  try {
    const env = await signViaBackend()
    if (mode === 'A') {
      const href = buildPayLink(env)
      const link = $('#paylink')
      link.classList.remove('empty')
      link.textContent = href
      mountCommon({ link: href })
      setStatus('st_ready_A', '', 'ok')
    } else {
      mountCommon({ order: env })
      setStatus('st_ready_B', '', 'ok')
    }
  } catch (err) {
    setStatus('st_signer_fail', err instanceof Error ? err.message : String(err), 'bad')
  }
}

// --- Language toggle -------------------------------------------------------
function applyLang() {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    el.textContent = t(el.dataset.i18n as string)
  }
  $('#mode-hint').textContent = t(`hint_${mode}`)
  renderStatus()
  ;($('#lang-toggle') as HTMLElement).textContent = lang === 'en' ? '中文' : 'EN'
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
}
function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en'
  applyLang()
}

// --- Wire up ---------------------------------------------------------------
renderProducts()
refresh()
applyLang()
$('#faucet').addEventListener('click', runFaucet)
$('#lang-toggle').addEventListener('click', toggleLang)
for (const el of Array.from(document.querySelectorAll<HTMLElement>('.mode'))) {
  el.addEventListener('click', () => void selectMode(el.dataset.mode as Mode))
}
void selectMode('C')
