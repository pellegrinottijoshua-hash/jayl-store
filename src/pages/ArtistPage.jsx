import { useCallback, useEffect, useRef, useState } from 'react'
import { useThemeStore } from '@/store/themeStore'

// Venti ritratti illustrati del founder, scontornati (WebP con alpha) così da
// poggiare direttamente sulla carta panna senza cornice. Ne è visibile UNO alla
// volta: ruota da solo ogni 4s, e passa al successivo al passaggio del mouse o
// al click. ~1,2 MB in tutto, ma non si scarica tutto: parte solo il primo e
// viene precaricato il successivo, quindi il costo iniziale è una sola immagine.
const PORTRAIT_COUNT = 20
const ROTATE_MS = 4000
const PORTRAITS = Array.from({ length: PORTRAIT_COUNT }, (_, i) => ({
  src: `/images/artist/artist-${String(i + 1).padStart(2, '0')}.webp`,
  alt: `Illustrated portrait of Joshua, ${i + 1} of ${PORTRAIT_COUNT}`,
}))

function PortraitRotator({ className = '' }) {
  const [index, setIndex] = useState(0)
  // Solo i ritratti già mostrati restano nel DOM: il primo render monta una
  // sola <img>, gli altri entrano quando arriva il loro turno e poi restano
  // montati, così tornare su uno già visto è istantaneo.
  const [seen, setSeen] = useState(() => new Set([0]))

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = (i + 1) % PORTRAIT_COUNT
      setSeen((s) => (s.has(next) ? s : new Set(s).add(next)))
      return next
    })
  }, [])

  // Precarica il prossimo fuori dal DOM, così il cambio non mostra mai un buco.
  useEffect(() => {
    const img = new Image()
    img.src = PORTRAITS[(index + 1) % PORTRAIT_COUNT].src
  }, [index])

  // La rotazione automatica riparte da zero a ogni interazione: senza questo,
  // un click a 3,9s verrebbe seguito da un secondo cambio 100ms dopo.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(advance, ROTATE_MS)
    return () => clearInterval(id)
  }, [advance, index])

  // Su touch il mouseenter sintetico arriva insieme al click e farebbe
  // avanzare di due. Ignora l'hover se l'ultimo evento è stato un tocco.
  const touchedRef = useRef(false)

  return (
    <button
      type="button"
      aria-label="Show the next portrait"
      onClick={advance}
      onMouseEnter={() => { if (!touchedRef.current) advance() }}
      onTouchStart={() => { touchedRef.current = true }}
      onMouseLeave={() => { touchedRef.current = false }}
      className={`relative block w-full cursor-pointer bg-transparent p-0 border-0 ${className}`}
    >
      {PORTRAITS.map((p, i) => (
        seen.has(i) && (
          <img
            key={p.src}
            src={p.src}
            alt={i === index ? p.alt : ''}
            aria-hidden={i === index ? undefined : true}
            decoding="async"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain object-bottom select-none transition-opacity duration-700 ease-out"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        )
      ))}
    </button>
  )
}

/** Falling-s: smaller, dropped, slightly rotated clockwise */
function FallingS({ scale = 1 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: `${0.48 * scale}em`,
        transform: 'rotate(15deg) translateY(0.25em)',
        transformOrigin: 'center bottom',
        opacity: 0.85,
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      s
    </span>
  )
}

export default function ArtistPage() {
  const { setPageTheme, setActiveSection } = useThemeStore()

  useEffect(() => {
    setPageTheme('light')
    setActiveSection('artist')
    document.body.style.overflow = ''
    // Force light colors on body/html regardless of OS dark mode
    document.documentElement.style.setProperty('color-scheme', 'light')
    document.body.style.backgroundColor = '#f5f0e8'
    document.body.style.color = '#111111'
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [setPageTheme, setActiveSection])

  return (
    <div
      className="min-h-screen w-screen bg-paper flex flex-col pt-[84px]"
      style={{ colorScheme: 'light', backgroundColor: '#f5f0e8', color: '#111111' }}
    >
      {/* Large heading with falling-s */}
      <div className="px-6 sm:px-10 lg:px-16 pt-10 sm:pt-16 flex-shrink-0">
        <h1
          className="font-display text-ink leading-[0.88] tracking-tight"
          style={{ fontSize: 'clamp(4rem, 16vw, 13rem)' }}
        >
          ARTIST'<FallingS />
        </h1>
      </div>

      {/* Gold rule */}
      <div className="px-6 sm:px-10 lg:px-16 mt-8 mb-10 flex-shrink-0">
        <div className="w-full" style={{ height: '1px', backgroundColor: '#C4A35A', opacity: 0.35 }} />
      </div>

      {/* Vision text + portrait column */}
      <div className="px-6 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] gap-12 lg:gap-16 items-start">
        <div className="max-w-2xl">
          <p className="font-display text-xl sm:text-2xl lg:text-3xl text-ink leading-[1.5] italic mb-8">
            Hi, I'm Joshua — a designer from Venice.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-5">
            I grew up surrounded by history and craftsmanship, in a city where beauty is
            ordinary. It taught me that art isn't something you look at. It's something you feel.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-5">
            So I make things that carry a feeling. Every piece here starts from one — a memory,
            a joke, a quiet moment of recognition — and tries to hold it in a shape you can wear.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-5">
            Two people can look at the same object and feel completely different things, and
            still both feel understood by it. That's the part worth chasing.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-8">
            I don't design for decoration. I design to spark something.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-8">
            Thank you for being here, and for supporting independent work. I hope something
            here speaks to you.
          </p>

          {/* Signature + link */}
          <p className="font-display italic font-light text-lg sm:text-xl mb-3" style={{ color: '#C4A35A' }}>
            — Joshua
          </p>
          <a
            href="https://pellegrinotti.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-secondary text-sm underline underline-offset-4 hover:text-ink transition-colors"
          >
            See my other work
          </a>
        </div>

        {/* Un solo ritratto alla volta, in rotazione. Altezza fissata sul
            contenitore: i venti file hanno proporzioni diverse e senza questo
            la pagina salterebbe a ogni cambio. */}
        <div className="lg:sticky lg:top-28">
          <PortraitRotator className="h-[380px] sm:h-[460px] lg:h-[620px]" />
        </div>
      </div>

      {/* Bottom padding */}
      <div className="pb-20" />
    </div>
  )
}
