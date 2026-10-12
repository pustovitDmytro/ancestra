import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const DEVICE_SCALE = Number(process.env.VISUAL_DEVICE_SCALE ?? 2);

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: DEVICE_SCALE,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  webServer: {
    command: `vite --config vite.visual.config.ts --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
