import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useSwipe } from '@/hooks/useSwipe'

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
  const navigate = useNavigate()

  useEffect(() => {
    setPageTheme('light')
    setActiveSection('artist')
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [setPageTheme, setActiveSection])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') navigate('/objects')
      if (e.key === 'ArrowUp')   navigate('/objects')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeDown: () => navigate('/objects'),
    onSwipeUp:   () => navigate('/objects'),
  })

  return (
    <div
      className="h-screen w-screen bg-paper overflow-hidden relative flex flex-col pt-14"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
      <div className="px-6 sm:px-10 lg:px-16 overflow-y-auto">
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
    </div>
  )
}
