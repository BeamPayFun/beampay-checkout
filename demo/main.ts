import {
  connect,
  getAccount,
  signTypedData,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { type Address, type Hex, formatUnits, parseUnits } from 'viem'
import { SUPPORTED_CHAINS, chainId } from '../src/chains'
import { getWagmiConfig } from '../src/controllers/wagmi-config'
import { BeamPay } from '../src/index'
import { getRouterAddress } from '../src/lib/router'
import type { BeamPayCheckoutOptions } from '../src/types'

// --- BSC testnet demo constants -------------------------------------------
const TUSDT = '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c' as Address
const TUSDT_DECIMALS = 6
const TUSDT_SYMBOL = 'tUSDT'
const CHAIN = 'bsc-testnet' as const
const TTL_SEC = 86400 * 7 // 7 days

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
  buyer: { en: 'Buyer', zh: '买家' },
  merchant: { en: 'Merchant', zh: '商户' },
  s1_title: { en: 'Place order', zh: '下单' },
  s1_hint: {
    en: 'Confirm the cart and generate order params (chain / token / amount / orderId). Then hand off to the merchant to sign.',
    zh: '确认购物车，生成订单参数（链 / 代币 / 金额 / orderId）。下单后交由商户签署。',
  },
  place_order: { en: 'Place order', zh: '下单' },
  reset: { en: '↻ New order', zh: '↻ 重新下单' },
  s2_title: { en: 'Sign order', zh: '签署订单' },
  s2_hint: {
    en: 'Merchant connects a wallet and signs the EIP-712 Order. The connected wallet is merchant / receiver / signer.',
    zh: '商户连接钱包，对 EIP-712 Order 进行签名。连接的钱包即 merchant / receiver / signer。',
  },
  sign_order: { en: 'Connect wallet & sign', zh: '连接钱包并签署' },
  s3_title: { en: 'Pay', zh: '支付' },
  s3_hint: {
    en: 'Shows the payout address; connect a wallet to complete payment.',
    zh: '显示收款地址，用户连接钱包完成支付。',
  },
  // summary field labels
  k_amount: { en: 'Amount', zh: '金额' },
  k_token: { en: 'Token', zh: '代币' },
  k_orderId: { en: 'orderId', zh: 'orderId' },
  k_merchant: { en: 'Merchant', zh: '商户' },
  k_signature: { en: 'Signature', zh: '签名' },
  k_payaddr: { en: 'Payout address', zh: '收款地址' },
  // status messages
  st_connecting: { en: 'Connecting wallet…', zh: '连接钱包…' },
  st_minting: { en: 'Minting 100 tUSDT…', zh: '铸造 100 tUSDT…' },
  st_minted: { en: 'Minted 100 tUSDT ✓', zh: '已铸造 100 tUSDT ✓' },
  st_faucet_fail: { en: (e) => `Faucet failed: ${e}`, zh: (e) => `领取失败: ${e}` },
  st_cart_empty: { en: 'Cart is empty — add an item first.', zh: '购物车为空，请先加购商品。' },
  st_order_generated: {
    en: 'Order created, waiting for merchant signature…',
    zh: '订单已生成，等待商户签署…',
  },
  st_connect_merchant: { en: 'Connecting merchant wallet…', zh: '连接商户钱包…' },
  st_sign_prompt: {
    en: 'Sign the EIP-712 Order in your wallet…',
    zh: '请在钱包中签署 EIP-712 Order…',
  },
  st_signed: {
    en: 'Order signed ✓ — click to pay.',
    zh: '订单已签署 ✓，点击完成支付。',
  },
  st_sign_fail: { en: (e) => `Signing failed: ${e}`, zh: (e) => `签署失败: ${e}` },
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
      if (phase !== 'cart') return
      qty[(b as HTMLElement).dataset.inc as string]++
      refresh()
    })
  }
  for (const b of Array.from(root.querySelectorAll('button[data-dec]'))) {
    b.addEventListener('click', () => {
      if (phase !== 'cart') return
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

// Status is stored by key (+ optional arg) so it re-translates on language toggle.
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

function shortHex(s: string, n = 6): string {
  if (!s) return ''
  return `${s.slice(0, n + 2)}…${s.slice(-4)}`
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

// Connect the injected wallet and pin it to the demo chain. Returns the address.
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

// --- EIP-712 typed data (mirrors BeamPayRouter ORDER_TYPEHASH) -------------
interface TypedDataParams {
  merchant: Address
  receiver: Address
  signer: Address
  token: Address
  amount: bigint
  orderId: Hex
  createdAt: bigint
  expiresAt: bigint
}

function buildOrderTypedData(p: TypedDataParams) {
  return {
    domain: {
      name: 'BeamPayRouter',
      version: '1',
      chainId: SUPPORTED_CHAINS[CHAIN].id,
      verifyingContract: getRouterAddress(CHAIN),
    },
    types: {
      Order: [
        { name: 'merchant', type: 'address' },
        { name: 'receiver', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'orderId', type: 'bytes32' },
        { name: 'createdAt', type: 'uint64' },
        { name: 'expiresAt', type: 'uint64' },
      ],
    },
    primaryType: 'Order' as const,
    message: {
      merchant: p.merchant,
      receiver: p.receiver,
      signer: p.signer,
      token: p.token,
      amount: p.amount,
      orderId: p.orderId,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    },
  } as const
}

function randomOrderId(): Hex {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}` as Hex
}

// --- Step state machine ----------------------------------------------------
type Phase = 'cart' | 'ordered' | 'signed'
let phase: Phase = 'cart'

interface OrderDraft {
  amount: bigint
  orderId: Hex
  createdAt: number
  expiresAt: number
}
let draft: OrderDraft | null = null
let signed: { merchant: Address; signature: Hex } | null = null

// Summary renderers read from stored state so they re-translate on lang toggle.
function renderOrderSummary() {
  const el = $('#order-summary')
  if (!draft) {
    el.classList.add('empty')
    el.innerHTML = ''
    return
  }
  el.classList.remove('empty')
  el.innerHTML = `
    <div><span class="k">${t('k_amount')}</span> ${formatUnits(draft.amount, TUSDT_DECIMALS)} ${TUSDT_SYMBOL}</div>
    <div><span class="k">${t('k_token')}</span> ${TUSDT_SYMBOL} · ${shortHex(TUSDT)}</div>
    <div><span class="k">${t('k_orderId')}</span> ${shortHex(draft.orderId, 8)}</div>`
}
function renderSignSummary() {
  const el = $('#sign-summary')
  if (!signed) {
    el.classList.add('empty')
    el.innerHTML = ''
    return
  }
  el.classList.remove('empty')
  el.innerHTML = `
    <div><span class="k">${t('k_merchant')}</span> ${shortHex(signed.merchant)}</div>
    <div><span class="k">${t('k_signature')}</span> ${signed.signature.slice(0, 22)}…${signed.signature.slice(-12)}</div>`
}
function renderPayAddr() {
  const el = $('#pay-addr')
  if (!signed) {
    el.classList.add('empty')
    el.innerHTML = ''
    return
  }
  el.classList.remove('empty')
  el.innerHTML = `<span class="k">${t('k_payaddr')}</span><br>${signed.merchant}`
}

// Reflect `phase` onto the three step cards (lock / active styling + buttons).
function updateGating() {
  const step1 = $('#step1')
  const step2 = $('#step2')
  const step3 = $('#step3')
  const signBtn = $('#sign-order') as HTMLButtonElement

  for (const el of [step1, step2, step3]) el.classList.remove('active')
  // Cart qty buttons follow phase (re-render is cheap and resets disabled state).
  for (const b of Array.from($('#products').querySelectorAll('button'))) {
    ;(b as HTMLButtonElement).disabled = phase !== 'cart'
  }

  step2.classList.toggle('locked', phase === 'cart')
  step3.classList.toggle('locked', phase !== 'signed')
  signBtn.disabled = phase !== 'ordered'

  if (phase === 'cart') step1.classList.add('active')
  else if (phase === 'ordered') step2.classList.add('active')
  else step3.classList.add('active')
}

// --- Step 1: buyer places the order ----------------------------------------
function placeOrder() {
  const amount = totalWei()
  if (amount <= 0n) {
    setStatus('st_cart_empty', '', 'bad')
    return
  }
  const createdAt = Math.floor(Date.now() / 1000)
  draft = {
    amount,
    orderId: randomOrderId(),
    createdAt,
    expiresAt: createdAt + TTL_SEC,
  }
  phase = 'ordered'

  renderOrderSummary()
  ;($('#place-order') as HTMLElement).style.display = 'none'
  ;($('#reset') as HTMLElement).style.display = ''
  setStatus('st_order_generated')
  updateGating()
}

// --- Step 2: merchant connects + signs the order ---------------------------
async function signOrder() {
  if (!draft) return
  const btn = $('#sign-order') as HTMLButtonElement
  btn.disabled = true
  try {
    setStatus('st_connect_merchant')
    const merchant = await ensureWallet()
    // Self-signed path: merchant == receiver == signer.
    const typedData = buildOrderTypedData({
      merchant,
      receiver: merchant,
      signer: merchant,
      token: TUSDT,
      amount: draft.amount,
      orderId: draft.orderId,
      createdAt: BigInt(draft.createdAt),
      expiresAt: BigInt(draft.expiresAt),
    })
    setStatus('st_sign_prompt')
    const signature = (await signTypedData(config, typedData)) as Hex

    const envelope: BeamPayCheckoutOptions = {
      chain: CHAIN,
      merchant,
      receiver: merchant,
      token: TUSDT,
      amount: draft.amount.toString(),
      orderId: draft.orderId,
      signer: merchant,
      createdAt: draft.createdAt,
      expiresAt: draft.expiresAt,
      signature,
      decimals: TUSDT_DECIMALS,
      symbol: TUSDT_SYMBOL,
    }
    phase = 'signed'
    signed = { merchant, signature }

    renderSignSummary()
    setStatus('st_signed', '', 'ok')
    updateGating()
    mountWidget(envelope)
  } catch (err) {
    setStatus('st_sign_fail', err instanceof Error ? err.message : String(err), 'bad')
    btn.disabled = false
  }
}

// --- Step 3: show pay address + mount the widget ---------------------------
function mountWidget(opts: BeamPayCheckoutOptions) {
  renderPayAddr()

  // Fresh mount target each time (mount() replaces the node it's given).
  const row = $('.pay-row')
  row.innerHTML = '<div id="pay"></div>'
  BeamPay.init({
    ...opts,
    onSuccess: (order) => setStatus('st_paid', order.txHash ?? '', 'ok'),
    onError: (e) => setStatus('st_pay_error', e.message, 'bad'),
  }).mount('#pay')
}

// --- Reset: start a new order ----------------------------------------------
function resetFlow() {
  phase = 'cart'
  draft = null
  signed = null
  ;($('#place-order') as HTMLElement).style.display = ''
  ;($('#reset') as HTMLElement).style.display = 'none'
  renderOrderSummary()
  renderSignSummary()
  renderPayAddr()
  $('.pay-row').innerHTML = '<div id="pay"></div>'
  ;($('#sign-order') as HTMLButtonElement).disabled = true
  setStatus(null)
  updateGating()
}

// --- Language toggle -------------------------------------------------------
function applyLang() {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    el.textContent = t(el.dataset.i18n as string)
  }
  // Re-render dynamic parts from stored state.
  renderOrderSummary()
  renderSignSummary()
  renderPayAddr()
  renderStatus()
  // Toggle button shows the *other* language.
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
updateGating()
applyLang()
$('#faucet').addEventListener('click', runFaucet)
$('#place-order').addEventListener('click', placeOrder)
$('#sign-order').addEventListener('click', signOrder)
$('#reset').addEventListener('click', resetFlow)
$('#lang-toggle').addEventListener('click', toggleLang)
