import { Star } from 'lucide-react'
import reviews from '@/data/reviews.json'

/**
 * Sezione recensioni in fondo alla home.
 *
 * Legge src/data/reviews.json a build time invece di chiamare /api/reviews:
 * il file è piccolo, sta già nel bundle, e ogni approvazione dall'admin
 * committa su main — che fa partire un deploy. Quindi il dato è comunque
 * fresco senza pagare una chiamata di rete sulla pagina più vista del sito.
 *
 * Due regole sul contenuto, ed è il motivo per cui questo non è una map()
 * dentro HomePage:
 *
 * 1. Una recensione per persona. Chi ha comprato due capi e ha lasciato lo
 *    stesso testo su entrambi è legittimo sulle rispettive pagine prodotto,
 *    ma in vetrina lo stesso testo due volte sembra un bug.
 * 2. Nessuna selezione per voto. Si mostrano le più recenti, comprese quelle
 *    tiepide: cinque stelle piene in fila sono il segnale più sospetto che una
 *    pagina recensioni possa dare, e una critica vera fa credere alle altre.
 */

// Sei e non cinque: la griglia e' a tre colonne, quindi sei riempie due righe
// piene mentre cinque lascia un buco in basso a destra che sembra un errore di
// caricamento. Se un giorno le recensioni diventano molte, il numero giusto
// resta un multiplo di tre.
const MAX = 6

function Stars({ rating }) {
  if (!rating) return null
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={12}
          strokeWidth={0}
          className={i < rating ? 'fill-ink' : 'fill-ink-muted/30'}
        />
      ))}
    </div>
  )
}

export default function HomeReviews() {
  const approved = reviews.filter(r => r.status === 'approved')

  // Una per autore, la più recente vince.
  const seen = new Set()
  const shown = approved
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter(r => {
      const key = (r.author || '').trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX)

  // Niente recensioni, niente sezione: uno spazio vuoto che dice "zero
  // recensioni" vende meno che non avere la sezione del tutto.
  if (shown.length === 0) return null

  return (
    <section className="w-screen bg-paper py-20 sm:py-28">
      <div className="px-6 sm:px-12 lg:px-20 max-w-6xl mx-auto">
        <p className="text-2xs font-sans tracking-label-xl uppercase text-ink-muted mb-10">
          what people say
        </p>

        <ul className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(r => (
            <li key={r.id} className="flex flex-col gap-3">
              <Stars rating={r.rating} />

              <p className="font-display text-lg sm:text-xl text-ink leading-[1.5]">
                {r.body}
              </p>

              <p className="text-2xs font-sans tracking-label uppercase text-ink-muted">
                {r.author}
                {/* L'origine va detta. Una recensione guadagnata su Etsy resta
                    una recensione vera, ma spacciarla per raccolta qui no. */}
                {r.source === 'etsy' && ' · via Etsy'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
