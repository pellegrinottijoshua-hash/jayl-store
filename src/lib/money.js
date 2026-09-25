import { useSyncExternalStore } from 'react'
import { formatPrice } from '@/lib/utils'
import { SYMBOL } from '@/store/currencyStore'

// Un solo orologio per tutta la pagina: ogni prezzo cambia €↔$ nello stesso
// istante, ogni 1,5 s.
const SWAP_MS = 1500
let tick = 0
const subs = new Set()
setInterval(() => { tick = 1 - tick; subs.forEach((f) => f()) }, SWAP_MS)
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export function useSwapSymbol() {
  const t = useSyncExternalStore(subscribe, () => tick)
  return t ? SYMBOL.usd : SYMBOL.eur
}

/** "€22" → "22": il numero e' lo stesso in euro e in dollari. */
export const amountOnly = (cents) => formatPrice(cents).replace(/[^\d.,]/g, '')
