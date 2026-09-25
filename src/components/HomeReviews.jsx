import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Star } from 'lucide-react'
import reviews from '@/data/reviews.json'

/**
 * Recensioni in home: una sola alla volta, a rotazione, con dissolvenza
 * laterale (entra da destra, esce a sinistra).
 *
 * Legge src/data/reviews.json a build time invece di chiamare /api/reviews:
 * il file è piccolo, sta già nel bundle, e ogni approvazione dall'admin
 * committa su main — che fa partire un deploy. Quindi il dato è comunque
 * fresco senza pagare una chiamata di rete sulla pagina più vista del sito.
 *
 * Due regole sul contenuto:
 *
 * 1. Una recensione per persona. Chi ha comprato due capi e ha lasciato lo
 *    stesso testo su entrambi è legittimo sulle rispettive pagine prodotto,
 *    ma in vetrina lo stesso testo due volte sembra un bug.
 * 2. Nessuna selezione per voto. Si mostrano le più recenti, comprese quelle
 *    tiepide: cinque stelle piene in fila sono il segnale più sospetto che una
 *    pagina recensioni possa dare, e una critica vera fa credere alle altre.
 */

const MAX = 8

// Quanto resta a schermo ogni recensione: un attimo per le brevi, di più per
// le lunghe — a tempo fisso di un secondo una frase da cento caratteri non si
// finisce di leggere prima che sparisca.
const holdMs = (text = '') => Math.min(5000, 2000 + text.length * 30)

function Stars({ rating }) {
  if (!rating) return null
  return (
    <div className="flex justify-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={12}
          strokeWidth={0}
          className={i < rating ? 'fill-cream' : 'fill-cream/25'}
        />
      ))}
    </div>
  )
}

const approved = reviews.filter(r => r.status === 'approved')
const seen = new Set()
const shown = approved
  .slice()
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  // Una per autore, la più recente vince.
  .filter(r => {
    const key = (r.author || '').trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  .slice(0, MAX)

export default function HomeReviews() {
  const reduce = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  const r = shown[idx]
  useEffect(() => {
    if (paused || shown.length < 2) return
    const t = setTimeout(() => setIdx(i => (i + 1) % shown.length), holdMs(r?.body))
    return () => clearTimeout(t)
  }, [idx, paused, r])

  // Niente recensioni, niente sezione: uno spazio vuoto che dice "zero
  // recensioni" vende meno che non avere la sezione del tutto.
  if (shown.length === 0) return null

  return (
    <section
      data-nav-theme="dark"
      className="w-screen bg-off-black py-16 sm:py-24 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-center text-2xs font-sans tracking-label-xl uppercase text-text-muted mb-8">
        what people say
      </p>

      <div className="relative px-6 sm:px-12 max-w-2xl mx-auto min-h-[160px] sm:min-h-[180px]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={r.id}
            className="flex flex-col items-center gap-4 text-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -48 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Stars rating={r.rating} />
            <blockquote className="font-display text-xl sm:text-2xl text-cream leading-[1.45]">
              “{r.body}”
            </blockquote>
            <figcaption className="text-2xs font-sans tracking-label uppercase text-text-muted">
              {r.author}
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
    </section>
  )
}
