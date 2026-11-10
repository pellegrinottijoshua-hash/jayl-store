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
    <section data-nav-theme="dark" className="w-screen bg-off-black px-5 py-5 sm:py-6 flex justify-center">
      <a
        href={SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Rated ${RATING} out of 5 on Etsy — open our Etsy shop`}
        className="flex items-stretch bg-white text-neutral-800 rounded-sm overflow-hidden shadow-lg transition-opacity hover:opacity-90"
      >
        <span className="flex items-center justify-center bg-neutral-100 px-5 sm:px-6 font-sans font-bold text-3xl sm:text-4xl leading-none">
          {RATING}
        </span>
        <span className="flex flex-col justify-center gap-1.5 px-4 sm:px-5 py-3">
          <span className="flex items-center gap-2.5">
            <img src="/etsy-logo.png" alt="Etsy" className="h-6 sm:h-7 w-auto" width="57" height="28" />
            <span className="h-5 w-px bg-neutral-300" aria-hidden="true" />
            <span className="font-sans text-xs sm:text-sm tracking-[0.12em] uppercase">Customer Reviews</span>
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={20} strokeWidth={0} fill={ETSY_ORANGE} />
            ))}
          </span>
        </span>
      </a>
    </section>
  )
}
