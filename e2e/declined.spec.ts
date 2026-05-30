import { expect, test } from '@playwright/test'

test.skip('user rejects wallet signature → onError fires with code USER_REJECTED', async ({
  page,
}) => {
  // requires mocked wallet provider that rejects eth_sendTransaction
  await page.goto('/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await page.locator('beam-wallet-picker [data-rdns="io.metamask"]').click()

  await expect(page.locator('beam-status-screen[data-state="failed"]')).toBeVisible()

  const result = await page.locator('#result').textContent()
  expect(result).toContain('ERROR:')
  expect(result).toContain('USER_REJECTED')
})

test.skip('insufficient balance → onError fires with code INSUFFICIENT_FUNDS', async ({ page }) => {
  await page.goto('/merchant-page.html')

  await page.locator('beam-pay-button').click()
  await page.locator('beam-wallet-picker [data-rdns="io.metamask"]').click()

  await expect(page.locator('beam-status-screen[data-state="failed"]')).toBeVisible()

  const result = await page.locator('#result').textContent()
  expect(result).toContain('INSUFFICIENT_FUNDS')
})
