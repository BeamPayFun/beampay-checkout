import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

type StatusState = 'pending' | 'success' | 'error' | 'expired'

@customElement('beam-status-screen')
export class StatusScreen extends LitElement {
  @property() state: StatusState = 'pending'
  @property() message = ''

  static override styles = css`
    :host { display: flex; flex-direction: column; align-items: center; padding: 16px 0; }
    .icon { font-size: 48px; margin-bottom: 12px; }
    .label { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .msg { font-size: 13px; color: #6b7280; text-align: center; max-width: 280px; }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #e5e7eb;
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `

  private get icon() {
    return { pending: '', success: '✅', error: '❌', expired: '⏰' }[this.state]
  }

  private get label() {
    return {
      pending: 'Processing…',
      success: 'Payment Confirmed',
      error: 'Payment Failed',
      expired: 'Order Expired',
    }[this.state]
  }

  override render() {
    return html`
      ${this.state === 'pending' ? html`<div class="spinner"></div>` : html`<div class="icon">${this.icon}</div>`}
      <div class="label">${this.label}</div>
      ${this.message ? html`<div class="msg">${this.message}</div>` : ''}
    `
  }
}
