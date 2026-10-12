import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { GED_DIR_PATH, listGedFixtures, SCREENSHOT_DIR } from './fixtures';

const fixtures = listGedFixtures();

test.describe('GED tree render screenshots', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  if (fixtures.length === 0) {
    test('no GED fixtures in ged/', () => {
      test.skip(true, `Add *.ged files under ${GED_DIR_PATH}`);
    });
    return;
  }

  for (const gedFile of fixtures) {
    test(gedFile, async ({ page }) => {
      await page.goto(`/tests/visual/harness.html?ged=${encodeURIComponent(gedFile)}`);

      await expect(page.locator('[data-testid="tree-canvas"] .family-tree-canvas')).toBeVisible();
      await expect(page.locator('.react-flow__node')).not.toHaveCount(0);

      await page.waitForFunction(
        () => document.documentElement.dataset.treeRendered === 'true',
        undefined,
        { timeout: 15_000 }
      );

      const slug = basename(gedFile, '.ged');
      const outPath = join(SCREENSHOT_DIR, `${slug}.png`);

      await page.locator('.family-tree-canvas').screenshot({
        path: outPath,
        scale: 'device',
        animations: 'disabled',
      });

      await test.info().attach(slug, {
        path: outPath,
        contentType: 'image/png',
      });
    });
  }
});
