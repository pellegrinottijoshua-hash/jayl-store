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
      </div>

      {/* Bottom padding */}
      <div className="pb-20" />
    </div>
  )
}
