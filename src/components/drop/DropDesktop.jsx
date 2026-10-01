import { getDrop } from '../../../api/_lib/drop.js'
import { nextDropStartsAt } from '../../../api/_lib/drop-schedule.js'
import DropCountdown from './DropCountdown'
import DropHero from './DropHero'
import SubscribeForm from '@/components/SubscribeForm'
import { dropWindowState, BEFORE } from './dropWindowState'

/**
 * Il drop su desktop: lo stesso primo schermo del telefono (DropHero: NEW, il
 * cilindro col pezzo davanti in video, prezzo "shipped"), a tutta altezza, e
 * sotto la lista d'attesa.
 *
 * Prima qui c'erano tre schede affiancate con tre video in loop insieme:
 * nessun pezzo protagonista, NEW e prezzo minuscoli negli angoli (1/10).
 */
export default function DropDesktop() {
  const cfg = getDrop()
  const { state, target } = dropWindowState(cfg)

  // Prima che il drop apra, "il prossimo drop" e' questo: un secondo
  // countdown verso cfg.next metterebbe due date diverse per la stessa
  // apertura. Aperto o chiuso, torna a voler dire il drop successivo.
  const nextStartsAt = nextDropStartsAt(cfg)

  return (
    <>
      <div className="h-[100svh] min-h-[640px] flex flex-col">
        <DropHero />
      </div>

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
              Never miss a new release.
            </h2>
            <p className="text-fg/60 text-sm leading-relaxed mb-6">
              New designs land every few days at a launch price. After that they stay in
              the collection at full price. Join the list and get the next ones first.
            </p>
            {state === BEFORE ? (
              <DropCountdown to={target} label="opens in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            ) : nextStartsAt && (
              <DropCountdown to={nextStartsAt} label="next release in" className="block text-xs tracking-widest uppercase text-fg/50 tabular-nums mb-8" />
            )}
            <SubscribeForm variant="waitlist" />
          </div>
        </div>
      </div>
    </>
  )
}
