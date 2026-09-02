import { Link } from 'react-router-dom'
import { getProductById } from '@/data/products'
import { getDrop } from '../../../api/_lib/drop.js'
import { useDropStatus } from '@/hooks/useDropStatus'
import DropCountdown from './DropCountdown'
import DropBadge from './DropBadge'
import { formatPrice } from '@/lib/utils'

/**
 * Primo schermo della home: i pezzi del drop, tutti visibili insieme.
 * Niente hero a rotazione — su un negozio da tre prodotti nasconderebbe due
 * terzi del catalogo in ogni istante.
 */
export default function DropPanels() {
  const cfg = getDrop()
  const { status } = useDropStatus()

  // Fra un drop e l'altro `current.productIds` è vuoto: si mostrano i pezzi del
  // drop appena chiuso, marcati, con il countdown all'apertura del prossimo.
  // Lo schermo non resta mai vuoto.
  const live  = (cfg.current?.productIds || []).length > 0
  const shown = live ? cfg.current.productIds : (cfg.previous?.productIds || [])
  const head  = live ? cfg.current : (cfg.previous || cfg.current)
  const open  = live && Date.now() < Date.parse(cfg.current?.endsAt || 0)
  const items = shown.map(getProductById).filter(Boolean)
  if (items.length === 0) return null

  return (
    <section className="min-h-screen w-screen bg-off-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[88px] pb-4 text-cream">
        <span className="text-xs tracking-[0.2em] uppercase">
          Drop {String(head.number).padStart(2, '0')} · {head.title}
        </span>
        {open
          ? <DropCountdown to={cfg.current.endsAt} label="finisce tra" className="text-xs tabular-nums" />
          : cfg.next?.startsAt
            ? <DropCountdown to={cfg.next.startsAt} label="prossimo drop tra" className="text-xs tabular-nums" />
            : null}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
        {items.map((p) => {
          const s = status?.products?.[p.id]
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="relative group overflow-hidden bg-off-black">
              <img
                src={p.heroImage ?? p.image}
                alt={p.altText || p.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                <h2 className="text-cream text-lg leading-tight">{p.name}</h2>
                <p className="text-white/70 text-sm mb-1">
                  {formatPrice(live ? cfg.current.dropPrice : cfg.archivePrice)}
                </p>
                {live
                  ? <DropBadge sold={s?.sold ?? 0} cap={s?.cap ?? cfg.current.cap} />
                  : <span className="text-xs tracking-widest uppercase text-white/60">
                      Drop chiuso · ora in listino
                    </span>}
              </div>
            </Link>
          )
        })}
      </div>

      {live && items.length === 3 && (
        <p className="px-5 py-4 text-center text-xs tracking-[0.2em] uppercase text-white/60">
          tutti e tre · {formatPrice(cfg.current.bundlePrice)}
        </p>
      )}
    </section>
  )
}
