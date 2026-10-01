import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ── NEW ──────────────────────────────────────────────────────────────────────
// Il titolo del drop in home, telefono (DropHero) e desktop (DropDesktop).
// Un ciclo, non un'insegna accesa: le lettere arrivano sfocate e larghe e si
// stringono a fuoco, la parola tiene, poi se ne va in dissolvenza e per un
// attimo non c'e' niente. Il vuoto fa parte dell'animazione: e' quello che fa
// tornare a guardare.
const NEW_IN    = 1.4  // entrata (s)
const NEW_HOLD  = 2.6  // parola ferma
const NEW_OUT   = 0.9  // uscita
const NEW_REST  = 0.9  // vuoto prima del giro dopo

const EASE_OUT_EXPO    = [0.16, 1, 0.3, 1]
const EASE_IN_QUART    = [0.5, 0, 0.75, 0]

const letterVariants = {
  hidden: ({ i, o }) => ({
    opacity: 0,
    filter: 'blur(12px)',
    x: `${o * 0.22}em`,
    transition: { duration: NEW_OUT * 0.8, delay: i * 0.07, ease: EASE_IN_QUART },
  }),
  shown: ({ i }) => ({
    opacity: 1,
    filter: 'blur(0px)',
    x: '0em',
    transition: { duration: NEW_IN - 0.2, delay: 0.1 + i * 0.1, ease: EASE_OUT_EXPO },
  }),
}

// Il carattere di NEW, in un posto solo. Deve essere caricato in index.html.
const NEW_FONT = { family: "'Tenor Sans', 'Space Grotesk', sans-serif", weight: 400, tracking: '0.18em' }

export default function NewMark({ word = 'NEW', fontSize = 'clamp(4.25rem, 21vw, 8.5rem)' }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (reduce) { setShown(true); return }
    let t
    const step = (next) => {
      setShown(next)
      t = setTimeout(() => step(!next), (next ? NEW_IN + NEW_HOLD : NEW_OUT + NEW_REST) * 1000)
    }
    t = setTimeout(() => step(true), 200)
    return () => clearTimeout(t)
  }, [reduce])

  return (
    <motion.h1
      aria-label={word}
      className="relative leading-[0.9] flex justify-center select-none mb-3 text-accent [[data-site-theme=cream]_&]:text-ink"
      style={{ fontFamily: NEW_FONT.family, fontWeight: NEW_FONT.weight, fontSize, letterSpacing: NEW_FONT.tracking, paddingLeft: `calc(${NEW_FONT.tracking} + 0.04em)` }}
      initial="hidden"
      animate={shown ? 'shown' : 'hidden'}
    >
      {word.split('').map((l, i) => (
        <motion.span key={i} aria-hidden custom={{ i, o: i - (word.length - 1) / 2 }} variants={letterVariants} className="inline-block will-change-transform">
          {l}
        </motion.span>
      ))}
    </motion.h1>
  )
}
