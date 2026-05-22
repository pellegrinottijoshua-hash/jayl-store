import { useEffect } from 'react'
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
            The great movements of art history were not conclusions — they were openings.
            Each one established a new way of seeing: a grammar, a gaze, a set of obsessions
            that defined how a generation understood beauty, tension, and truth.
            Then time ran out. The artists died. The movements calcified into museums.
          </p>

          <p className="text-ink-secondary leading-relaxed text-base sm:text-lg mb-8">
            JAYL continues from where they stopped. The same visual languages, applied to the
            world those artists never lived to paint — its textures, its figures, its quiet
            and loud moments. Not as tribute. As continuation.
          </p>

          {/* Payoff */}
          <p className="font-display italic font-light text-lg sm:text-xl" style={{ color: '#C4A35A' }}>
            Art finds a way.
          </p>
        </div>
      </div>

      {/* Bottom padding */}
      <div className="pb-20" />
    </div>
  )
}
