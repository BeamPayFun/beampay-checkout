import { type Config, connect, getAccount } from '@wagmi/core'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

interface EIP6963ProviderInfo {
  name: string
  icon: string
  rdns: string
}

interface EIP6963Detail {
  info: EIP6963ProviderInfo
  provider: unknown
}

@customElement('beam-wallet-picker')
export class WalletPicker extends LitElement {
  /** Shared wagmi config from the checkout instance. */
  @property({ attribute: false }) config?: Config
  @state() private providers: EIP6963Detail[] = []
  @state() private connecting = false
  @state() private errorMsg = ''

  static override styles = css`
    :host { display: block; width: 100%; }
    .provider-list { display: flex; flex-direction: column; gap: 8px; }
    .provider-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px;
      cursor: pointer; background: white; width: 100%; text-align: left;
      font-size: 14px; font-weight: 500;
    }
    .provider-btn:hover { background: #f9fafb; }
    .provider-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    img { width: 24px; height: 24px; }
    .wc-btn { margin-top: 4px; color: #6366f1; border-color: #6366f1; }
    .err { color: #dc2626; font-size: 13px; margin-top: 8px; }
    .empty { color: #6b7280; font-size: 13px; }
  `

  override connectedCallback() {
    super.connectedCallback()
    window.addEventListener('eip6963:announceProvider', this.handleAnnounce as EventListener)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('eip6963:announceProvider', this.handleAnnounce as EventListener)
  }

  private handleAnnounce = (e: Event) => {
    const detail = (e as CustomEvent<EIP6963Detail>).detail
    if (!this.providers.find((p) => p.info.rdns === detail.info.rdns)) {
      this.providers = [...this.providers, detail]
    }
  }

  private get wcConnector() {
    return this.config?.connectors.find((c) => c.type === 'walletConnect')
  }

  private async connectWith(connectorType: 'injected' | 'walletConnect') {
    if (!this.config || this.connecting) return
    // Already connected (config persists, or same wallet signed) — proceed.
    if (getAccount(this.config).isConnected) {
      this.dispatchEvent(
        new CustomEvent('beam-wallet-connected', { bubbles: true, composed: true }),
      )
      return
    }
    const connector = this.config.connectors.find((c) => c.type === connectorType)
    if (!connector) {
      this.errorMsg = 'No matching wallet connector configured'
      return
    }
    this.connecting = true
    this.errorMsg = ''
    try {
      await connect(this.config, { connector })
      this.dispatchEvent(
        new CustomEvent('beam-wallet-connected', { bubbles: true, composed: true }),
      )
    } catch (err) {
      this.errorMsg = err instanceof Error ? err.message : String(err)
    } finally {
      this.connecting = false
    }
  }

  override render() {
    return html`
      <div class="provider-list">
        ${
          this.providers.length === 0
            ? html`<div class="empty">No browser wallet detected — install MetaMask.</div>`
            : this.providers.map(
                (p) => html`
                  <button
                    class="provider-btn"
                    ?disabled=${this.connecting}
                    @click=${() => this.connectWith('injected')}
                  >
                    <img src=${p.info.icon} alt=${p.info.name} />
                    ${p.info.name}
                  </button>
                `,
              )
        }
        ${
          this.wcConnector
            ? html`<button
                class="provider-btn wc-btn"
                ?disabled=${this.connecting}
                @click=${() => this.connectWith('walletConnect')}
              >
                WalletConnect
              </button>`
            : ''
        }
      </div>
      ${this.errorMsg ? html`<div class="err">${this.errorMsg}</div>` : ''}
    `
  }
}
