import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'

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
      className="min-h-screen w-screen bg-paper flex flex-col pt-14"
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

      {/* Rule */}
      <div className="px-6 sm:px-10 lg:px-16 mt-8 mb-10 flex-shrink-0">
        <div className="w-full h-px bg-paper-border" />
      </div>

      {/* Vision text */}
      <div className="px-6 sm:px-10 lg:px-16">
        <div className="max-w-2xl">
          <p className="font-display text-xl sm:text-2xl lg:text-3xl text-ink leading-[1.5] italic mb-8">
            "Every great artist drew the world differently — they saw their world. JAYL takes the
            greatest visual languages in history and applies them to subjects, emotions, and
            landscapes they never reached. This is what they would have made. If they had seen
            what we see."
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-5">
            JAYL is a singular creative premise: that the great art movements of history weren't
            finished. They were cut short by mortality, by the limits of what their world
            contained. Impressionism never saw a server farm. Surrealism never witnessed machine
            learning. Cubism never faced the infinite simultaneous perspectives of a social media
            feed.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg">
            JAYL is the answer — a body of work that continues what history left unfinished,
            applied to the subjects those movements never reached.
          </p>
        </div>
      </div>

      {/* Photo placeholder + tagline + CTA */}
      <div className="flex flex-col items-center px-6 sm:px-10 lg:px-16 mt-16 mb-20">
        {/* 3:4 photo placeholder */}
        <div
          className="w-full max-w-xs sm:max-w-sm bg-black flex items-center justify-center"
          style={{ aspectRatio: '3 / 4' }}
        >
          <span
            className="text-white tracking-widest"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}
          >
            JAYL
          </span>
        </div>

        {/* Tagline */}
        <p
          className="mt-8 max-w-xs sm:max-w-sm text-center text-ink-secondary leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '0.95rem' }}
        >
          Based in Italy. Working across every movement, every era. Using AI as the brush,
          history as the canvas.
        </p>

        {/* CTA */}
        <Link
          to="/art"
          className="mt-8 inline-flex items-center gap-2 font-sans text-xs tracking-[0.15em] uppercase text-ink border-b border-ink/30 pb-0.5 hover:border-ink transition-colors duration-300"
        >
          Discover the Art →
        </Link>
      </div>
    </div>
  )
}
