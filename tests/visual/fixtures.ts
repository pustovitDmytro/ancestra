import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures');
const GED_DIR = join(process.cwd(), 'ged');
const MANIFEST = join(GED_DIR, 'visual-tests.json');

function listGed(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ged'))
    .sort();
}

/** GED filenames to render: public fixtures plus the private ged/ selection */
export function listGedFixtures(): string[] {
  return [...new Set([...listGed(FIXTURE_DIR), ...listLocalGed()])];
}

/** Private trees from ged/, narrowed by ged/visual-tests.json when present */
function listLocalGed(): string[] {
  if (existsSync(MANIFEST)) {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as
      | string[]
      | { fixtures?: string[] };
    const files = Array.isArray(parsed) ? parsed : parsed.fixtures;
    if (Array.isArray(files) && files.length > 0) {
      return files.filter((f) => f.endsWith('.ged')).sort();
    }
  }
  return listGed(GED_DIR);
}

export const GED_DIR_PATH = GED_DIR;
export const SCREENSHOT_DIR = join(process.cwd(), 'tmp/test_execution_results');
