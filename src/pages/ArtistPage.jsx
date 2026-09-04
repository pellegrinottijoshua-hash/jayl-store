import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

// Ritratti animati del founder. Sono dipinti in chiaroscuro: il nero non è un
// fondale dietro la figura, è l'ombra di cui la figura è fatta — capelli,
// panciotto e lato in ombra del viso ci si fondono dentro. Per questo restano
// su fondo scuro invece di essere scontornati su panna: un luma key toglie
// ~60% dei pixel e con quelli si porta via mezzo soggetto. La cornice scura
// sulla carta panna è la scelta che tiene insieme il quadro.
const PORTRAITS = [
  { src: '/video/artist-1.mp4', poster: '/video/artist-1.jpg', alt: 'Illustrated portrait of Joshua waving' },
  { src: '/video/artist-2.mp4', poster: '/video/artist-2.jpg', alt: 'Illustrated portrait of Joshua in a leather jacket' },
  { src: '/video/artist-3.mp4', poster: '/video/artist-3.jpg', alt: 'Illustrated portrait of Joshua looking aside' },
]

function PortraitLoop({ src, poster, alt, className = '' }) {
  return (
    <figure
      className={`relative overflow-hidden rounded-sm shadow-[0_18px_40px_-24px_rgba(17,17,17,0.55)] ${className}`}
      style={{ backgroundColor: '#0d0d0d', border: '1px solid rgba(196,163,90,0.28)' }}
    >
      <video
        className="block w-full h-full object-cover"
        src={src}
        poster={poster}
        aria-label={alt}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    </figure>
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

        {/* Portrait column — staggered stack on desktop, swipeable row on mobile */}
        <div className="lg:sticky lg:top-28">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 pb-2 lg:mx-0 lg:px-0 lg:pb-0 lg:block lg:overflow-visible">
            {PORTRAITS.map((p, i) => (
              <PortraitLoop
                key={p.src}
                {...p}
                className={[
                  'shrink-0 basis-[62%] snap-center aspect-[9/16]',
                  'sm:basis-[42%]',
                  'lg:w-[72%] lg:basis-auto lg:aspect-[9/14]',
                  i === 1 ? 'lg:ml-auto lg:-mt-16' : '',
                  i === 2 ? 'lg:ml-[14%] lg:-mt-12' : '',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="pb-20" />
    </div>
  )
}
