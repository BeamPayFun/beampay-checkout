import { expect, test } from '@playwright/test'

test.skip('prompts wallet chain switch when current chain != config.chain', async ({ page }) => {
  // requires mocked wallet provider connected to wrong chain
  await page.goto('/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await page.locator('beam-wallet-picker [data-rdns="io.metamask"]').click()

  await expect(page.locator('beam-pay-modal [data-action="switch-chain"]')).toBeVisible()
})

test.skip('proceeds to sign step after successful chain switch', async ({ page }) => {
  await page.goto('/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await page.locator('beam-wallet-picker [data-rdns="io.metamask"]').click()
  await page.locator('beam-pay-modal [data-action="switch-chain"]').click()

  await expect(page.locator('beam-status-screen[data-state="signing"]')).toBeVisible()
})
