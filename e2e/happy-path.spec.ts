import { expect, test } from '@playwright/test'

test('mounts pay button and renders Lit element', async ({ page }) => {
  await page.goto('/fixtures/merchant-page.html')

  const btn = page.locator('beam-pay-button')
  await expect(btn).toBeVisible()
})

test('clicking pay button opens modal', async ({ page }) => {
  await page.goto('/fixtures/merchant-page.html')

  await page.locator('beam-pay-button').click()

  const modal = page.locator('beam-pay-modal')
  await expect(modal).toBeVisible()
})

test('modal shows the wallet picker on the connect step', async ({ page }) => {
  await page.goto('/fixtures/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await expect(page.locator('beam-pay-modal beam-wallet-picker')).toBeVisible()
})

test.skip('full happy path: connect → pay → poll → onSuccess fires', async ({ page }) => {
  // requires an injected wallet provider on BSC testnet + a funded account
  await page.goto('/fixtures/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await page.locator('beam-wallet-picker .provider-btn').first().click()
  await page.locator('beam-pay-modal button.primary').click()

  await expect(page.locator('beam-status-screen[state="success"]')).toBeVisible({ timeout: 60_000 })

  const result = await page.locator('#result').textContent()
  expect(result).toContain('PAID:')
})
