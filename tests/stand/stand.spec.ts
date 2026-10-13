import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadStand(value: string) {
  vi.stubEnv('VITE_STAND', value);
  vi.resetModules();
  return import('@/lib/stand');
}

describe('standKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the plain key on the main site', async () => {
    const { STAND, standKey } = await loadStand('');
    expect(STAND).toBe('');
    expect(standKey('ancestra')).toBe('ancestra');
  });

  it('namespaces the key on a preview stand', async () => {
    const { STAND, standKey } = await loadStand(' ancestra-2-preview ');
    expect(STAND).toBe('ancestra-2-preview');
    expect(standKey('ancestra')).toBe('ancestra@ancestra-2-preview');
  });
});
