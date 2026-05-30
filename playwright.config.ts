import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // Serve the project root so `/src/index.ts` (imported by the fixture and the
    // demo) resolves; fixture pages live under `/fixtures/`, the demo under `/demo/`.
    command: 'vite --port 5173',
    // Health-check a real page — vite returns 404 on `/` (no root index.html),
    // which playwright would treat as "not ready".
    url: 'http://localhost:5173/fixtures/merchant-page.html',
    reuseExistingServer: !process.env['CI'],
  },
})
