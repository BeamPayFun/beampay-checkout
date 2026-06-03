import type { OrderEnvelope } from '@beampay/schemas'
import { type Config, getAccount } from '@wagmi/core'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { formatUnits } from 'viem'
import { type ChainKey, explorerTxUrl, isChainKey } from '../chains'
import { type PayStep, runPayment } from '../controllers/pay-controller'
import { resolveOrder, toPayableOrder } from '../controllers/resolve'
import './wallet-picker'
import './status-screen'
import type { CheckoutInit, OrderStatus, PayableOrder } from '../types'

type Step = 'preparing' | 'connect' | 'confirm' | 'pending' | 'success' | 'error'

const STEP_LABEL: Record<PayStep, string> = {
  switching: 'Switching network…',
  approving: 'Approve token in your wallet…',
  confirming: 'Confirm payment in your wallet…',
  pending: 'Waiting for confirmation…',
}

@customElement('beam-pay-modal')
export class PayModal extends LitElement {
  @property({ attribute: false }) init?: CheckoutInit
  @property({ attribute: false }) config?: Config
  @state() private step: Step = 'preparing'
  @state() private progress = ''
  @state() private errorMsg = ''
  @state() private order?: OrderStatus
  @state() private env?: OrderEnvelope
  private payable?: PayableOrder

  static override styles = css`
    :host {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.5);
    }
    .modal {
      background: white; border-radius: 16px; padding: 32px;
      width: 380px; max-width: calc(100vw - 32px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h2 { margin: 0 0 16px; font-size: 20px; }
    .close { float: right; background: none; border: none; cursor: pointer; font-size: 20px; }
    .summary {
      background: #f9fafb; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;
      font-size: 14px; display: flex; justify-content: space-between; align-items: baseline;
    }
    .summary .amount { font-size: 20px; font-weight: 700; }
    .actions { display: flex; gap: 8px; margin-top: 20px; }
    button.primary {
      flex: 1; background: #6366f1; color: white; border: none;
      border-radius: 8px; padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    button.primary:hover { background: #4f46e5; }
    .txlink { display: block; margin-top: 12px; font-size: 13px; color: #6366f1; text-align: center; }
  `

  override connectedCallback() {
    super.connectedCallback()
    void this.prepare()
  }

  /** Resolve the order source (inline / link / callback) before showing payment. */
  private async prepare() {
    if (!this.init) {
      this.errorMsg = 'BeamPay: missing options'
      this.step = 'error'
      return
    }
    this.step = 'preparing'
    try {
      const env = await resolveOrder(this.init)
      this.env = env
      this.payable = toPayableOrder(env)
      // Wallet already connected (e.g. same wallet signed the order) — skip the picker.
      this.step = this.config && getAccount(this.config).isConnected ? 'confirm' : 'connect'
    } catch (err) {
      this.fail(err)
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('beam-pay-close', { bubbles: true, composed: true }))
  }

  private get amountLabel() {
    if (!this.env) return ''
    const decimals = this.init?.decimals ?? 18
    const formatted = formatUnits(BigInt(this.env.amount), decimals)
    return `${formatted} ${this.init?.symbol ?? ''}`.trim()
  }

  override render() {
    return html`
      <div class="modal" role="dialog" aria-modal="true">
        <button class="close" @click=${this.close} aria-label="Close">×</button>
        <h2>Pay with BeamPay</h2>
        ${
          this.env
            ? html`<div class="summary">
                <span>Amount due</span>
                <span class="amount">${this.amountLabel}</span>
              </div>`
            : ''
        }
        ${this.step === 'preparing' ? this.renderPreparing() : ''}
        ${this.step === 'connect' ? this.renderConnect() : ''}
        ${this.step === 'confirm' ? this.renderConfirm() : ''}
        ${this.step === 'pending' ? this.renderPending() : ''}
        ${this.step === 'success' ? this.renderSuccess() : ''}
        ${this.step === 'error' ? this.renderError() : ''}
      </div>
    `
  }

  private renderPreparing() {
    return html`<beam-status-screen
      state="pending"
      .message=${'Preparing order…'}
    ></beam-status-screen>`
  }

  private renderConnect() {
    return html`
      <p>Connect your wallet to complete this payment.</p>
      <beam-wallet-picker
        .config=${this.config}
        @beam-wallet-connected=${() => {
          this.step = 'confirm'
        }}
      ></beam-wallet-picker>
    `
  }

  private renderConfirm() {
    return html`
      <p>Review the amount above, then confirm the payment in your wallet.</p>
      <div class="actions">
        <button class="primary" @click=${this.submitPayment}>Pay now</button>
      </div>
    `
  }

  private renderPending() {
    return html`<beam-status-screen state="pending" .message=${this.progress}></beam-status-screen>`
  }

  private renderSuccess() {
    return html`
      <beam-status-screen state="success"></beam-status-screen>
      ${this.renderTxLink()}
    `
  }

  private renderError() {
    return html`<beam-status-screen state="error" .message=${this.errorMsg}></beam-status-screen>`
  }

  private renderTxLink() {
    if (!this.order?.txHash || !this.env || !isChainKey(this.env.chain)) return ''
    const chain: ChainKey = this.env.chain
    return html`<a
      class="txlink"
      href=${explorerTxUrl(chain, this.order.txHash)}
      target="_blank"
      rel="noreferrer"
      >View transaction ↗</a
    >`
  }

  private fail(err: unknown) {
    this.errorMsg = err instanceof Error ? err.message : String(err)
    this.step = 'error'
    this.dispatchEvent(
      new CustomEvent('beam-pay-error', {
        detail: err instanceof Error ? err : new Error(this.errorMsg),
        bubbles: true,
        composed: true,
      }),
    )
  }

  private submitPayment = async () => {
    if (!this.config || !this.payable) {
      this.fail(new Error('BeamPay: missing config or order'))
      return
    }
    this.step = 'pending'
    this.progress = STEP_LABEL.confirming
    try {
      const order = await runPayment(this.config, this.payable, (s) => {
        this.progress = STEP_LABEL[s]
      })
      this.order = order
      this.step = 'success'
      this.dispatchEvent(
        new CustomEvent('beam-pay-success', { detail: order, bubbles: true, composed: true }),
      )
    } catch (err) {
      this.fail(err)
    }
  }
}
