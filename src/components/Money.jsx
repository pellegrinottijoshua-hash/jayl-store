import { AnimatePresence, motion } from 'framer-motion'
import { useSwapSymbol, amountOnly } from '@/lib/money'

/** Il simbolo che sfuma da € a $ e ritorno, stessa dissolvenza di NEW. */
export function SwapSymbol({ className = '' }) {
  const sym = useSwapSymbol()
  return (
    <span className={`relative inline-grid justify-items-center ${className}`}>
      {/* Tiene la larghezza del simbolo piu' largo: € e $ non hanno la stessa
          larghezza, e senza questo il testo accanto andava a capo al cambio. */}
      <span aria-hidden className="col-start-1 row-start-1 invisible">€</span>
      <span aria-hidden className="col-start-1 row-start-1 invisible">$</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={sym}
          className="col-start-1 row-start-1"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.45 }}
        >
          {sym}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Prezzo con simbolo alternato: <Money cents={2200} /> → €22 / $22. */
export default function Money({ cents, className = '' }) {
  return <span className={className}><SwapSymbol />{amountOnly(cents)}</span>
}
