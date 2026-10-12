import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GED_DIR = join(process.cwd(), 'ged');
const MANIFEST = join(GED_DIR, 'visual-tests.json');

/** GED filenames to render; falls back to every *.ged in ged/ */
export function listGedFixtures(): string[] {
  if (existsSync(MANIFEST)) {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as
      | string[]
      | { fixtures?: string[] };
    const files = Array.isArray(parsed) ? parsed : parsed.fixtures;
    if (Array.isArray(files) && files.length > 0) {
      return files.filter((f) => f.endsWith('.ged')).sort();
    }
  }
  return readdirSync(GED_DIR)
    .filter((f) => f.endsWith('.ged'))
    .sort();
}

export const GED_DIR_PATH = GED_DIR;
export const SCREENSHOT_DIR = join(process.cwd(), 'tmp/test_execution_results');
