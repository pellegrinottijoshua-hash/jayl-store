import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductById } from '@/data/products'
import { getDrop, capFor } from '../../../api/_lib/drop.js'
import { useDropStatus } from '@/hooks/useDropStatus'
import DropCountdown from './DropCountdown'
import DropBadge from './DropBadge'
import { formatPrice, cn } from '@/lib/utils'
import { dropWindowState, BEFORE, LIVE, CLOSED } from './dropWindowState'

/**
 * Barra del drop + i pezzi — prima metà dello schermo unico della home
 * (la seconda metà, la lista d'attesa, vive in HomePage: le due sono state
 * fuse in un solo <section> così tutto sta sopra la piega, senza scroll per
 * arrivare all'iscrizione). Ogni pezzo è 4:5, con nome/prezzo/stato SOTTO
 * l'immagine — non più in overlay, quindi niente scrim a gradiente.
 *
 * Sotto sm: i tre pezzi diventano uno swipe orizzontale a scroll-snap con
 * peek ~10% del prossimo: impilare tre 4:5 interi spingerebbe la lista
 * d'attesa a ~1400px di scroll, esattamente ciò che lo schermo unico vuole
 * evitare. Un IntersectionObserver sul track individua quale card è
 * centrata; solo il suo testo resta visibile sotto la card, e i puntini
 * sotto il track segnano la posizione. Da sm: in su tutti e tre i testi
 * sono sempre visibili sotto la propria colonna, come su schermi larghi.
 *
 * Non renderizza niente se il drop non ha pezzi — resta solo la lista
 * d'attesa nello screen che lo racchiude in HomePage.
 */
export default function DropPanels() {
  const cfg = getDrop()
  const { status } = useDropStatus()
  const [activeIdx, setActiveIdx] = useState(0)
  const trackRef = useRef(null)
  const cardRefs = useRef([])

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

  // Quale card è centrata nel track — guida sia il testo mostrato sotto
  // (solo quello del pezzo attivo, su mobile) sia i puntini indicatore.
  // IntersectionObserver invece di leggere scrollLeft: resta corretto a
  // prescindere dai px esatti di peek/gap qui sotto, tarati a occhio via
  // screenshot piuttosto che calcolati in astratto.
  useEffect(() => {
    const track = trackRef.current
    if (!track || items.length < 2) return
    const io = new IntersectionObserver(
      (entries) => {
        let best = null
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry
        }
        if (best && best.intersectionRatio > 0.5) {
          const idx = cardRefs.current.indexOf(best.target)
          if (idx !== -1) setActiveIdx(idx)
        }
      },
      { root: track, threshold: [0.5, 0.75, 0.99] }
    )
    cardRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [items.length])

  if (items.length === 0) return null

  return (
    // sm: and up caps + centers at the same width the rest of the site uses
    // (max-w-7xl, see Footer/ShopPage/ProductPage) — full-bleed with no cap
    // put a 3-column grid's images at (viewport / 3) wide, which is fine at
    // 1024 but balloons past ~640px-tall images once the viewport clears
    // ~1600px. Below sm: this is unset (mobile stays genuinely full-bleed —
    // the vw-based peek math on the track further down is relative to the
    // viewport, not this wrapper).
    <div className="sm:max-w-7xl sm:mx-auto">
      <div className="flex items-center justify-between px-5 sm:px-6 lg:px-8 pt-[88px] pb-3 sm:pb-6 text-cream">
        <span className="text-xs tracking-[0.2em] uppercase">
          Drop {String(head.number).padStart(2, '0')} · {head.title}
        </span>
        {state === BEFORE && (
          <DropCountdown to={target} label="opens in" className="text-xs tabular-nums" />
        )}
        {state === LIVE && (
          <DropCountdown to={target} label="ends in" className="text-xs tabular-nums" />
        )}
        {state === CLOSED && target && (
          <DropCountdown to={target} label="next drop in" className="text-xs tabular-nums" />
        )}
      </div>

      {/* Mobile: flex row, scroll-snap, peek ~10vw on each side (padding 13vw
          minus 3vw gap) — this inner padding is deliberately on a wrapper,
          not the grid track itself, so the track's own sm:bg-white/10 (below)
          paints only the gap-px hairlines between columns, not a solid band
          under this padding too. Desktop (sm: and up): plain 3-col grid,
          aligned with the bar above via the same px-6/lg:px-8. */}
      <div className="sm:px-6 lg:px-8">
      <div
        ref={trackRef}
        className="flex gap-[3vw] overflow-x-auto snap-x snap-mandatory scrollbar-hide px-[13vw] bg-transparent sm:grid sm:grid-cols-3 sm:gap-px sm:overflow-visible sm:snap-none sm:px-0 sm:bg-white/10"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((p, idx) => {
          const s = status?.products?.[p.id]
          return (
            <Link
              key={p.id}
              ref={(el) => { cardRefs.current[idx] = el }}
              to={`/product/${p.id}`}
              className="group flex-shrink-0 w-[74vw] snap-center bg-off-black sm:w-auto sm:flex-shrink"
            >
              <div className="aspect-[4/5] w-full overflow-hidden">
                <img
                  src={cfg.current.heroImages?.[p.id] ?? p.heroImage ?? p.image}
                  alt={p.altText || p.name}
                  // Screen 1, above the fold — the first card is the LCP candidate the
                  // old full-bleed hero used to be eager for. Only the first: the rest
                  // can still defer, no reason to fight the browser for all of them.
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  // fetchpriority isn't in this React 18.3 runtime's known-DOM-property
                  // table yet — set the real attribute imperatively via the ref instead
                  // of the fetchPriority prop, which logs a dev warning.
                  ref={idx === 0 ? (el) => { if (el) el.setAttribute('fetchpriority', 'high') } : undefined}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className={cn(
                'pt-3 pb-1 sm:px-5 sm:pt-4',
                idx === activeIdx ? 'block' : 'hidden',
                'sm:block'
              )}>
                <h2 className="text-cream text-base sm:text-lg leading-tight">{p.name}</h2>
                <p className="text-white/70 text-sm mb-1">
                  {formatPrice(showingCurrent ? cfg.current.dropPrice : cfg.archivePrice)}
                </p>
                {state === LIVE && (
                  <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? capFor(p.id, cfg)} />
                )}
                {state === BEFORE && (
                  <span className="text-xs tracking-widest uppercase text-white/60">
                    Preview · not on sale yet
                  </span>
                )}
                {state === CLOSED && (
                  <span className="text-xs tracking-widest uppercase text-white/60">
                    Drop closed · now in the archive
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
      </div>

      {/* Position indicator — mobile only, "n/total" via dots. Decorative:
          the real reachable content is the links above it. */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2.5 sm:hidden" aria-hidden="true">
          {items.map((p, idx) => (
            <span
              key={p.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                idx === activeIdx ? 'w-4 bg-cream' : 'w-1.5 bg-white/25'
              )}
            />
          ))}
        </div>
      )}

      {state === LIVE && items.length === 3 && (
        <p className="px-5 sm:px-6 lg:px-8 pt-4 text-center text-xs tracking-[0.2em] uppercase text-white/60">
          tutti e tre · {formatPrice(cfg.current.bundlePrice)}
        </p>
      )}
    </div>
  )
}
