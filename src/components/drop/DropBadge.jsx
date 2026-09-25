import { counterMode } from '../../../api/_lib/drop.js'

/**
 * Sotto il 30% venduto mostra solo la dimensione dell'edizione: al lancio,
 * "19 disponibili su 20" non comunica scarsità, dimostra che non compra nessuno.
 */
export default function DropBadge({ sold = 0, cap = 0, className = '' }) {
  const state = counterMode(sold, cap)
  if (state.mode === 'hidden') return null

  if (state.mode === 'soldout') {
    return <span className={`text-xs tracking-widest uppercase text-fg/60 ${className}`}>Sold out · {state.cap}/{state.cap}</span>
  }
  // Sotto la soglia non si dichiara piu' la dimensione dell'edizione: dire
  // "Edition of 20" prima che il contatore si accenda annuncia quanto poco c'e'
  // da vendere senza mostrare che qualcuno sta comprando. Il badge resta muto
  // finche' il contatore ha numeri che lavorano a favore.
  if (state.mode === 'edition') return null

  const pct = Math.round((state.sold / state.cap) * 100)
  return (
    <span className={`inline-flex items-center gap-2 text-xs tracking-widest uppercase text-amber-300 ${className}`}>
      {state.sold} / {state.cap} claimed
      <span className="inline-block h-1 w-16 rounded bg-fg/15 align-middle">
        <span className="block h-1 rounded bg-amber-300" style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}
