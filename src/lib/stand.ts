/** Branch name of a preview build; empty on the main site and in local dev */
export const STAND: string = (import.meta.env.VITE_STAND ?? '').trim();

/** All stands share the github.io origin, so browser storage is namespaced per stand */
export function standKey(name: string): string {
  return STAND ? `${name}@${STAND}` : name;
}
