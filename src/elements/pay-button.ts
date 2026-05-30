import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { CheckoutOptions } from '../types'

@customElement('beam-pay-button')
export class PayButton extends LitElement {
  @property({ attribute: false }) opts?: CheckoutOptions

  static override styles = css`
    :host { display: inline-block; }
    button {
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #4f46e5; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `

  private handleClick() {
    this.dispatchEvent(new CustomEvent('beam-pay-click', { bubbles: true, composed: true }))
  }

  override render() {
    return html`<button @click=${this.handleClick}>Pay with BeamPay</button>`
  }
}
