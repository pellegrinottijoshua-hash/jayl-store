import { useEffect, useMemo } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Instagram, Youtube } from 'lucide-react'
import personas from '@/data/personas.json'
import { products } from '@/data/products'
import { formatPrice } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'

// TikTok icon (Lucide doesn't include it)
function TikTokIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  )
}

export default function AmbassadorPage() {
  const { id } = useParams()
  const { setPageTheme, setActiveSection } = useThemeStore()

  const persona = personas.find((p) => p.id === id)

  // Recommended products — use all products (could be filtered by collection/section in the future)
  const recommendedProducts = useMemo(() => products.slice(0, 8), [])

  usePageMeta(persona ? {
    title:       persona.name,
    description: persona.bio?.slice(0, 160) || `${persona.name} — JAYL ambassador.`,
    image:       persona.referenceImages?.[0] ?? undefined,
  } : {})

  useEffect(() => {
    setPageTheme('light')
    setActiveSection(null)
    document.documentElement.style.setProperty('color-scheme', 'light')
    document.body.style.backgroundColor = '#f5f0e8'
    document.body.style.color = '#111111'
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [setPageTheme, setActiveSection])

  if (!persona) return <Navigate to="/" replace />

  const coverImage = persona.referenceImages?.[0]

  return (
    <div
      className="min-h-screen w-screen bg-paper"
      style={{ colorScheme: 'light', backgroundColor: '#f5f0e8', color: '#111111' }}
    >
      {/* ── Cover ────────────────────────────────────────── */}
      <div className="relative w-full h-[70vh] overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={persona.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="absolute inset-0 bg-paper-2" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/30 to-transparent" />

        {/* Back nav */}
        <div className="absolute top-[84px] left-6 sm:left-10 z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-2xs font-mono tracking-wider uppercase text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={12} /> Home
          </Link>
        </div>
      </div>

      {/* ── Identity ─────────────────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-16 -mt-24 relative z-10 pb-12">
        <div className="max-w-2xl">
          {/* Avatar: first reference image as circle, or initials */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-paper-2 border-4 border-paper mb-6 shadow-sm">
            {coverImage ? (
              <img src={coverImage} alt={persona.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-2xl text-ink-muted">
                  {persona.name?.[0] ?? '?'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">{persona.name}</h1>
              {persona.handle && (
                <p className="text-sm font-mono text-ink-muted mt-1">@{persona.handle}</p>
              )}
            </div>

            {/* Social links */}
            <div className="flex items-center gap-2 pb-1">
              {persona.instagram && (
                <a
                  href={`https://instagram.com/${persona.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-3 py-1.5 hover:border-ink hover:text-ink transition-colors"
                >
                  <Instagram size={11} /> Instagram
                </a>
              )}
              {persona.tiktok && (
                <a
                  href={`https://tiktok.com/@${persona.tiktok.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-3 py-1.5 hover:border-ink hover:text-ink transition-colors"
                >
                  <TikTokIcon size={11} /> TikTok
                </a>
              )}
              {persona.youtube && (
                <a
                  href={`https://youtube.com/@${persona.youtube.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-3 py-1.5 hover:border-ink hover:text-ink transition-colors"
                >
                  <Youtube size={11} /> YouTube
                </a>
              )}
            </div>
          </div>

          {persona.bio && (
            <p className="text-base text-ink/80 leading-relaxed mb-6 max-w-xl">{persona.bio}</p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {persona.aesthetic && (
              <span className="text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-2.5 py-1">
                {persona.aesthetic}
              </span>
            )}
            {persona.contentStyle && (
              <span className="text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-2.5 py-1">
                {persona.contentStyle}
              </span>
            )}
            {persona.targetAudience && (
              <span className="text-2xs font-mono tracking-wider uppercase text-ink-muted border border-paper-border px-2.5 py-1">
                {persona.targetAudience}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Reference images ──────────────────────────────── */}
      {persona.referenceImages?.length > 1 && (
        <div className="px-6 sm:px-10 lg:px-16 pb-16">
          <div className="h-px bg-paper-border mb-8" />
          <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-4">Visual identity</p>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {persona.referenceImages.map((url, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-40 sm:w-48 aspect-square bg-paper-2 overflow-hidden"
              >
                <img
                  src={url}
                  alt={`${persona.name} reference ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Shop the look ─────────────────────────────────── */}
      <div className="px-6 sm:px-10 lg:px-16 pb-16">
        <div className="h-px bg-paper-border mb-8" />
        <p className="text-2xs font-mono tracking-ultra uppercase text-ink-muted mb-6">Shop the look</p>

        <div
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {recommendedProducts.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="flex-shrink-0 w-44 sm:w-52 group"
            >
              <div className="w-full aspect-[3/4] overflow-hidden bg-paper-2 mb-3">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
              <h3 className="font-display text-sm text-ink leading-tight truncate">{product.name}</h3>
              <p className="text-xs text-ink-muted mt-0.5">from {formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
