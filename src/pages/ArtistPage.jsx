import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

export default function ArtistPage() {
  const { setPageTheme } = useThemeStore()

  useEffect(() => {
    setPageTheme('light')
    return () => setPageTheme('light')
  }, [setPageTheme])

  return (
    <div className="min-h-screen bg-white pt-16">
      {/* Large heading block */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-0">
        <h1 className="font-display text-[clamp(4rem,14vw,12rem)] text-ink leading-[0.88] tracking-tight">
          The<br />Artist.
        </h1>
      </div>

      {/* Rule */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 mb-20">
        <div className="w-full h-px bg-paper-border" />
      </div>

      {/* Vision statement + body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-32">
          {/* Left: quote */}
          <div>
            <p className="font-display text-2xl lg:text-3xl xl:text-4xl text-ink leading-relaxed italic">
              "Every great artist drew the world differently — they saw their world. JAYL takes the
              greatest visual languages in history and applies them to subjects, emotions, and
              landscapes they never reached. This is what they would have made. If they had seen
              what we see."
            </p>
          </div>

          {/* Right: body */}
          <div className="space-y-8 lg:pt-4">
            <p className="text-ink-secondary leading-relaxed text-lg">
              JAYL is a singular creative premise: that the great art movements of history weren't
              finished. They were cut short by mortality, by the limits of what their world
              contained. Impressionism never saw a server farm. Surrealism never witnessed machine
              learning. Cubism never faced the infinite simultaneous perspectives of a social media
              feed.
            </p>

            <p className="text-ink-secondary leading-relaxed text-lg">
              What would they have made? If Monet had stood before a data center at dusk, its
              exhaust vents steaming in the California light. If Dalí had watched a neural network
              hallucinate. If Kirchner's fractured city figures had stared down at their phones
              rather than into the modernist void.
            </p>

            <p className="text-ink-secondary leading-relaxed text-lg">
              JAYL is the answer — a body of work that continues what history left unfinished,
              applied to the subjects those movements never reached.
            </p>

            <div className="pt-4">
              <div className="w-8 h-px bg-ink-muted mb-6" />
              <p className="text-2xs font-mono tracking-ultra text-ink-muted uppercase mb-6">
                Six movements · Unlimited new subjects
              </p>
              <Link to="/shop?section=art" className="btn-ink inline-flex">
                View the Work
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom band */}
      <div className="border-t border-paper-border bg-paper py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Impressionism', note: 'Light dissolved into data' },
              { label: 'Surrealism', note: 'Machine dreamscapes' },
              { label: 'Cubism', note: 'Simultaneous perspectives' },
              { label: 'Art Nouveau', note: 'Organic interfaces' },
            ].map(({ label, note }) => (
              <Link
                key={label}
                to={`/shop?section=art&movement=${label.toLowerCase().replace(' ', '-')}`}
                className="group"
              >
                <div className="w-6 h-px bg-paper-border group-hover:bg-ink-muted transition-colors mb-3" />
                <p className="font-display text-lg text-ink group-hover:text-ink-secondary transition-colors leading-tight mb-1">
                  {label}
                </p>
                <p className="text-xs text-ink-muted">{note}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
