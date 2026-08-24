// NFD separa cada letra acentuada en base + marca diacrítica combinante,
// \p{Mn} ("mark, nonspacing") saca justo esas marcas — así "María" y
// "Maria" matchean al buscar.
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
}
