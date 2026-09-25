import { Link } from 'react-router-dom'
import { getProductById } from '@/data/products'
import { getDrop, capFor } from '../../../api/_lib/drop.js'
import { nextDropStartsAt } from '../../../api/_lib/drop-schedule.js'
import { useDropStatus } from '@/hooks/useDropStatus'
import DropCountdown from './DropCountdown'
import DropBadge from './DropBadge'
import SubscribeForm from '@/components/SubscribeForm'
import { formatPrice } from '@/lib/utils'
import { dropWindowState, BEFORE, LIVE, CLOSED } from './dropWindowState'

/**
 * Il drop su desktop (da sm: in su): tre schede affiancate, nome/prezzo/stato
 * sotto ciascuna, e sotto la lista d'attesa — come prima del ridisegno.
 * Il ridisegno (NEW, cilindro, prezzo "shipped") e' solo mobile, in
 * DropHero: su uno schermo largo le tre schede ci stanno gia' tutte intere,
 * e un carosello nasconderebbe due pezzi su tre senza motivo.
 */
export default function DropDesktop() {
  const cfg = getDrop()
  const { status } = useDropStatus()
  const { state, target } = dropWindowState(cfg)

  // Stesse regole di DropHero: i pezzi di `current` finche' ci sono, poi quelli
  // del drop appena chiuso — lo schermo non resta mai vuoto.
  const currentIds     = cfg.current?.productIds || []
  const showingCurrent = currentIds.length > 0
  const shown = showingCurrent ? currentIds : (cfg.previous?.productIds || [])
  const head  = showingCurrent ? cfg.current : (cfg.previous || cfg.current)
  const items = shown.map(getProductById).filter(Boolean)

  // Prima che il drop apra, "il prossimo drop" e' questo: un secondo
  // countdown verso cfg.next metterebbe due date diverse per la stessa
  // apertura. Aperto o chiuso, torna a voler dire il drop successivo.
  const nextStartsAt = nextDropStartsAt(cfg)

  return (
    <>
      {items.length > 0 && (
        <div className="max-w-7xl mx-auto w-full">
          <div className="px-6 lg:px-8 pt-[64px] pb-6 text-cream">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-[0.2em] uppercase">
                Drop {String(head.number).padStart(2, '0')} · {head.title}
              </span>
              {state === BEFORE && <DropCountdown to={target} label="opens in" className="text-xs tabular-nums" />}
              {state === LIVE && <DropCountdown to={target} label="closes in" className="text-xs tabular-nums" />}
              {state === CLOSED && target && <DropCountdown to={target} label="next drop in" className="text-xs tabular-nums" />}
            </div>
          </div>

          <div className="px-6 lg:px-8">
            <div className="grid grid-cols-3 gap-px bg-fg/10">
              {items.map((p, idx) => {
                const s = status?.products?.[p.id]
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="group bg-off-black">
                    <div className="aspect-[4/5] w-full overflow-hidden">
                      <img
                        src={cfg.current?.heroImages?.[p.id] ?? p.heroImage ?? p.image}
                        alt={p.altText || p.name}
                        loading={idx === 1 ? 'eager' : 'lazy'}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="px-5 pt-4 pb-1">
                      <h2 className="text-cream text-lg leading-tight">{p.name}</h2>
                      <p className="text-fg/70 text-sm mb-1">
                        {formatPrice(showingCurrent ? cfg.current.dropPrice : cfg.archivePrice)}
                      </p>
                      {state === LIVE && <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? capFor(p.id, cfg)} />}
                      {state === BEFORE && (
                        <span className="text-xs tracking-widest uppercase text-fg/60">Preview · not on sale yet</span>
                      )}
                      {state === CLOSED && (
                        <span className="text-xs tracking-widest uppercase text-fg/60">Drop closed · now in the archive</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center pt-8 pb-16">
        <div className="relative overflow-hidden px-12">
          {/* La J decorativa a filo destro, come negli altri blocchi del sito */}
          <span
            aria-hidden="true"
            className="absolute right-[-0.05em] top-1/2 -translate-y-1/2 font-display leading-none select-none pointer-events-none"
            style={{ fontSize: 'clamp(8rem, 20vw, 20rem)', color: '#C4A35A', opacity: 0.04, letterSpacing: '-0.05em' }}
          >J</span>

          <div className="relative max-w-md mx-auto w-full text-center">
            <p className="text-[10px] font-sans tracking-[0.25em] uppercase mb-4" style={{ color: '#C4A35A', opacity: 0.7 }}>
              Get notified
            </p>
            <h2 className="font-display text-4xl text-cream leading-tight mb-4">
              Never miss a drop.
            </h2>
            <p className="text-fg/60 text-sm leading-relaxed mb-6">
              Every drop is a limited edition — once it closes, the pieces go back to the
              archive at full price. Join the list for early access to the next one.
            </p>
            {state === BEFORE ? (
              <DropCountdown to={target} label="opens in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            ) : nextStartsAt && (
              <DropCountdown to={nextStartsAt} label="next drop in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            )}
            <SubscribeForm variant="waitlist" />
          </div>
        </div>
      </div>
    </>
  )
}
