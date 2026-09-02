import { counterMode } from '../../../api/_lib/drop.js'

/**
 * Sotto il 30% venduto mostra solo la dimensione dell'edizione: al lancio,
 * "19 disponibili su 20" non comunica scarsità, dimostra che non compra nessuno.
 */
export default function DropBadge({ sold = 0, cap = 0, className = '' }) {
  const state = counterMode(sold, cap)
  if (state.mode === 'hidden') return null

  if (state.mode === 'soldout') {
    return <span className={`text-xs tracking-widest uppercase text-white/60 ${className}`}>Sold out · {state.cap}/{state.cap}</span>
  }
  if (state.mode === 'edition') {
    return <span className={`text-xs tracking-widest uppercase text-white/60 ${className}`}>Edition of {state.cap}</span>
  }
  const pct = Math.round((state.sold / state.cap) * 100)
  return (
    <span className={`inline-flex items-center gap-2 text-xs tracking-widest uppercase text-amber-300 ${className}`}>
      {state.sold} / {state.cap} claimed
      <span className="inline-block h-1 w-16 rounded bg-white/15 align-middle">
        <span className="block h-1 rounded bg-amber-300" style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}
