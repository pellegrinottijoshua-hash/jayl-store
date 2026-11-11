/**
 * Una foto puo' stare in piu' forme: URL raw di GitHub, path relativo, e in
 * cartelle diverse se il prodotto e' stato rinominato (Lugia: la cartella era
 * "lugia-t-shirt-…", oggi "cool-lugia-t-shirt"). Il nome del file e' l'unica
 * parte stabile (hf_AAAAMMGG_… e' unico), quindi i lati Front/Back si
 * confrontano per nome file, non per URL intero.
 */
export const mediaKey = (u) => String(u || '').split('?')[0].split('/').pop()

/** Il lato ('front' | 'back') assegnato a una foto, o null. */
export function sideOfMedia(sides, url) {
  if (!sides || !url) return null
  if (sides[url]) return sides[url]
  const k = mediaKey(url)
  for (const [u, v] of Object.entries(sides)) if (mediaKey(u) === k) return v
  return null
}

/** Nuova mappa lati con `url` impostato a `side` (null = toglie), senza doppioni dello stesso file. */
export function withSide(sides, url, side) {
  const k = mediaKey(url)
  const next = Object.fromEntries(Object.entries(sides || {}).filter(([u]) => mediaKey(u) !== k))
  if (side) next[url] = side
  return next
}
