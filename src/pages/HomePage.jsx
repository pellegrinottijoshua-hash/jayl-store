import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

export default function HomePage() {
  const { setPageTheme } = useThemeStore()

  useEffect(() => {
    setPageTheme('light')
    return () => setPageTheme('light')
  }, [setPageTheme])

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO: full-width video placeholder ────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[600px] bg-black flex items-center justify-center overflow-hidden">
        {/* Play button */}
        <button
          className="group relative z-10 flex items-center justify-center w-24 h-24 rounded-full border border-white/30 hover:border-white/70 transition-all duration-500 hover:scale-110"
          aria-label="Play"
        >
          <Play
            size={32}
            className="text-white/60 group-hover:text-white transition-colors duration-300 ml-1"
            fill="currentColor"
          />
        </button>

        {/* Vision text — bottom overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/70 to-transparent px-6 sm:px-10 lg:px-20 pt-32 pb-14 lg:pb-20">
          <p className="font-display text-cream text-xl sm:text-2xl lg:text-[1.75rem] xl:text-[2rem] max-w-4xl leading-[1.45] tracking-[-0.01em]">
            Every great artist drew the world differently — they saw their world. JAYL takes the
            greatest visual languages in history and applies them to subjects, emotions, and
            landscapes they never reached. This is what they would have made. If they had seen
            what we see.
          </p>
        </div>
      </section>

      {/* ─── THREE SECTION CARDS ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 border-t border-paper-border">
        {/* ART */}
        <Link
          to="/shop?section=art"
          className="group relative flex flex-col justify-between p-10 lg:p-14 min-h-[44vh] bg-paper hover:bg-paper-2 transition-colors duration-500 border-b md:border-b-0 md:border-r border-paper-border overflow-hidden"
        >
          <span className="text-2xs font-mono tracking-ultra uppercase text-ink-muted">
            Fine Art Prints
          </span>
          <div>
            <h2 className="font-display text-[clamp(3.5rem,8vw,7rem)] text-ink leading-none mb-5">
              ART
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono tracking-ultra uppercase text-ink-muted">
              <span>Explore</span>
              <ArrowRight
                size={12}
                className="transform group-hover:translate-x-1.5 transition-transform duration-300"
              />
            </div>
          </div>
        </Link>

        {/* OBJECTS */}
        <Link
          to="/shop?section=objects"
          className="group relative flex flex-col justify-between p-10 lg:p-14 min-h-[44vh] bg-off-black hover:bg-black transition-colors duration-500 border-b md:border-b-0 md:border-r border-border overflow-hidden"
        >
          <span className="text-2xs font-mono tracking-ultra uppercase text-text-muted">
            Wearable Art
          </span>
          <div>
            <h2 className="font-display text-[clamp(3.5rem,8vw,7rem)] text-cream leading-none mb-5">
              OBJECTS
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono tracking-ultra uppercase text-text-muted">
              <span>Explore</span>
              <ArrowRight
                size={12}
                className="transform group-hover:translate-x-1.5 transition-transform duration-300"
              />
            </div>
          </div>
        </Link>

        {/* ARTIST */}
        <Link
          to="/artist"
          className="group relative flex flex-col justify-between p-10 lg:p-14 min-h-[44vh] bg-white hover:bg-paper transition-colors duration-500 overflow-hidden"
        >
          <span className="text-2xs font-mono tracking-ultra uppercase text-ink-muted">
            The Vision
          </span>
          <div>
            <h2 className="font-display text-[clamp(3.5rem,8vw,7rem)] text-ink leading-none mb-5">
              ARTIST
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono tracking-ultra uppercase text-ink-muted">
              <span>Explore</span>
              <ArrowRight
                size={12}
                className="transform group-hover:translate-x-1.5 transition-transform duration-300"
              />
            </div>
          </div>
        </Link>
      </section>

      {/* ─── PREMISE ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-paper-border bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36 text-center">
          <p className="section-label-light mb-8">The Premise</p>
          <blockquote className="font-display text-3xl lg:text-5xl text-ink leading-tight">
            "Every art movement was a response to its moment.
            <em className="text-ink-muted not-italic"> Ours is no different."</em>
          </blockquote>
          <p className="mt-10 text-ink-secondary leading-relaxed max-w-2xl mx-auto text-lg">
            Monet painted haystacks because haystacks were his world. If he were alive today,
            he'd paint server farms — those vast, humming monuments to computation. JAYL is
            the premise that the great movements aren't finished. They just need new subjects.
          </p>
          <Link to="/artist" className="btn-ink mt-12 inline-flex">
            Read the Vision
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── MOVEMENTS ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-paper-border bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <p className="section-label-light mb-10">Movements</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-paper-border">
            {[
              { id: 'impressionism', label: 'Impressionism', desc: 'Light dissolved into data' },
              { id: 'surrealism', label: 'Surrealism', desc: 'Machine dreamscapes' },
              { id: 'cubism', label: 'Cubism', desc: 'Multiple simultaneous feeds' },
              { id: 'expressionism', label: 'Expressionism', desc: 'The city\'s nervous system' },
              { id: 'art-nouveau', label: 'Art Nouveau', desc: 'Organic interfaces' },
              { id: 'bauhaus', label: 'Bauhaus', desc: 'Form as ideology' },
            ].map((m) => (
              <Link
                key={m.id}
                to={`/shop?section=art&movement=${m.id}`}
                className="group bg-paper hover:bg-paper-2 p-6 transition-colors duration-300"
              >
                <div className="w-6 h-px bg-paper-border group-hover:bg-ink-muted transition-colors duration-300 mb-4" />
                <h3 className="font-display text-base text-ink leading-tight mb-2 group-hover:text-ink-secondary transition-colors duration-200">
                  {m.label}
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">{m.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
