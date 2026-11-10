import { Star } from 'lucide-react'

/**
 * Badge col punteggio del negozio su Etsy, sotto il prezzo della home.
 * Scheda bianca col logo Etsy arancione e le stelle arancioni; un clic porta
 * allo shop. Il valore è quello che Etsy mostra nello shop: va aggiornato a
 * mano qui sotto quando cambia in modo visibile.
 */
const RATING = 4.9
const SHOP_URL = 'https://www.etsy.com/shop/JaylArtStore'
const ETSY_ORANGE = '#E0693A'

export default function EtsyRating() {
  return (
    <section data-nav-theme="dark" className="w-screen bg-off-black px-5 pt-8 pb-3 sm:pt-10 flex justify-center">
      <a
        href={SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Rated ${RATING} out of 5 on Etsy — open our Etsy shop`}
        className="flex items-stretch bg-white text-neutral-800 rounded-sm overflow-hidden shadow-lg transition-opacity hover:opacity-90"
      >
        <span className="flex items-center justify-center bg-neutral-100 px-4 sm:px-5 font-sans font-bold text-2xl sm:text-3xl leading-none">
          {RATING}
        </span>
        <span className="flex flex-col justify-center gap-1 px-3 sm:px-4 py-2">
          <span className="flex items-center gap-2.5">
            <img src="/etsy-logo.png" alt="Etsy" className="h-5 sm:h-6 w-auto" width="49" height="24" />
            <span className="h-4 w-px bg-neutral-300" aria-hidden="true" />
            <span className="font-sans text-[10px] sm:text-xs tracking-[0.12em] uppercase">Customer Reviews</span>
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={15} strokeWidth={0} fill={ETSY_ORANGE} />
            ))}
          </span>
        </span>
      </a>
    </section>
  )
}
