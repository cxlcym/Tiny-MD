import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/electron',
  testMatch: '**/*.spec.mjs',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
})
