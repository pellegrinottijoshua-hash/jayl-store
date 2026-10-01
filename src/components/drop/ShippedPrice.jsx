import { SwapSymbol } from '@/components/Money'
import { formatPrice } from '@/lib/utils'

// Il prezzo del drop come protagonista, in home su telefono e desktop: il
// numero centrato da solo, l'euro in apice fuori dal centro (absolute),
// "shipped" centrato sotto. La spedizione e' gratis ovunque: quello e' il
// prezzo finale.
export default function ShippedPrice({ cents, className = 'pt-3 pb-3', fontSize = 'clamp(4.25rem, 20vw, 6.5rem)' }) {
  return (
    <div className={`${className} text-center text-cream`}>
      <p className="font-display font-light leading-none" style={{ fontSize }}>
        <span className="relative inline-block">
          {formatPrice(cents).replace(/[^\d.,]/g, '')}
          <span className="absolute left-full top-[0.1em] ml-[0.05em] text-[0.34em]"><SwapSymbol /></span>
        </span>
      </p>
      {/* pl pari al tracking: la spaziatura dopo l'ultima lettera sposterebbe
          la parola a sinistra del centro. */}
      <p className="mt-1.5 text-[10px] tracking-[0.42em] pl-[0.42em] uppercase text-cream/60">shipped</p>
    </div>
  )
}
