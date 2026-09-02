import { Link } from 'react-router-dom'
import { getProductById } from '@/data/products'
import { getDrop, capFor } from '../../../api/_lib/drop.js'
import { useDropStatus } from '@/hooks/useDropStatus'
import DropCountdown from './DropCountdown'
import DropBadge from './DropBadge'
import { formatPrice } from '@/lib/utils'
import { dropWindowState, BEFORE, LIVE, CLOSED } from './dropWindowState'

/**
 * Primo schermo della home: i pezzi del drop, tutti visibili insieme.
 * Niente hero a rotazione — su un negozio da tre prodotti nasconderebbe due
 * terzi del catalogo in ogni istante.
 */
export default function DropPanels() {
  const cfg = getDrop()
  const { status } = useDropStatus()

  const { state, target } = dropWindowState(cfg)

  // `current.productIds` resta popolato finché l'admin non chiude il drop
  // esplicitamente (close-drop), anche dopo endsAt — quindi lo stato CLOSED
  // può arrivare sia da lì sia da un current già svuotato. In entrambi i casi
  // i pezzi da mostrare sono quelli di `current` se ci sono ancora, altrimenti
  // quelli del drop appena chiuso (`previous`). Lo schermo non resta mai vuoto.
  const currentIds     = cfg.current?.productIds || []
  const showingCurrent = currentIds.length > 0
  const shown = showingCurrent ? currentIds : (cfg.previous?.productIds || [])
  const head  = showingCurrent ? cfg.current : (cfg.previous || cfg.current)
  const items = shown.map(getProductById).filter(Boolean)
  if (items.length === 0) return null

  return (
    <section className="min-h-screen w-screen bg-off-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[88px] pb-4 text-cream">
        <span className="text-xs tracking-[0.2em] uppercase">
          Drop {String(head.number).padStart(2, '0')} · {head.title}
        </span>
        {state === BEFORE && (
          <DropCountdown to={target} label="apre tra" className="text-xs tabular-nums" />
        )}
        {state === LIVE && (
          <DropCountdown to={target} label="finisce tra" className="text-xs tabular-nums" />
        )}
        {state === CLOSED && target && (
          <DropCountdown to={target} label="prossimo drop tra" className="text-xs tabular-nums" />
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
        {items.map((p, idx) => {
          const s = status?.products?.[p.id]
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="relative group overflow-hidden bg-off-black">
              <img
                src={cfg.current.heroImages?.[p.id] ?? p.heroImage ?? p.image}
                alt={p.altText || p.name}
                // Screen 1, above the fold — the first panel is the LCP candidate the
                // old hero used to be eager for. Only the first: the rest can still
                // defer, no reason to fight the browser for all of them.
                loading={idx === 0 ? 'eager' : 'lazy'}
                // fetchpriority isn't in this React 18.3 runtime's known-DOM-property
                // table yet (only the JSX-facing eslint-plugin-react rule knows the
                // camelCase name) — passing fetchPriority as a normal prop logs a dev
                // warning ("does not recognize the fetchPriority prop"). Set the real
                // attribute imperatively via the ref instead, so it lands in the DOM
                // for the browser's loader without going through that prop diffing.
                ref={idx === 0 ? (el) => { if (el) el.setAttribute('fetchpriority', 'high') } : undefined}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                <h2 className="text-cream text-lg leading-tight">{p.name}</h2>
                <p className="text-white/70 text-sm mb-1">
                  {formatPrice(showingCurrent ? cfg.current.dropPrice : cfg.archivePrice)}
                </p>
                {state === LIVE && (
                  <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? capFor(p.id, cfg)} />
                )}
                {state === BEFORE && (
                  <span className="text-xs tracking-widest uppercase text-white/60">
                    Anteprima · non ancora in vendita
                  </span>
                )}
                {state === CLOSED && (
                  <span className="text-xs tracking-widest uppercase text-white/60">
                    Drop chiuso · ora in listino
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {state === LIVE && items.length === 3 && (
        <p className="px-5 py-4 text-center text-xs tracking-[0.2em] uppercase text-white/60">
          tutti e tre · {formatPrice(cfg.current.bundlePrice)}
        </p>
      )}
    </section>
  )
}
