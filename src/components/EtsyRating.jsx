import { Star } from 'lucide-react'

/**
 * Striscia con il punteggio del negozio su Etsy, subito sotto il primo schermo
 * della home. Il valore è quello che Etsy mostra a Joshua nel suo shop
 * (4.9, tutte recensioni di acquirenti verificati): va aggiornato a mano
 * qui sotto quando cambia in modo visibile.
 */
const RATING = 4.9

export default function EtsyRating() {
  return (
    <section
      data-nav-theme="dark"
      className="w-screen bg-off-black border-y border-cream/10 py-6 px-6"
      aria-label={`Rated ${RATING} out of 5 on Etsy`}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-center gap-4 sm:gap-6">
        <span className="font-display text-4xl sm:text-5xl text-cream leading-none">{RATING}</span>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-0.5" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={16} strokeWidth={0} className="fill-cream" />
            ))}
          </div>
          <p className="text-2xs font-sans tracking-label uppercase text-text-muted">
            Etsy customer reviews · verified buyers
          </p>
        </div>
      </div>
    </section>
  )
}
