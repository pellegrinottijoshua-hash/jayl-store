import { useState, useMemo, useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { products } from '@/data/products'
import { formatPrice, slugToTitle, isNewProduct } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { usePageMeta } from '@/hooks/usePageMeta'

/** Match a collection name to a URL slug */
function collectionSlug(name) {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CollectionPage() {
  const { slug } = useParams()
  const { setPageTheme, setActiveSection } = useThemeStore()
  const [sortBy, setSortBy] = useState('default')

  // Find items that belong to this collection
  const collectionProducts = useMemo(
    () => products.filter((p) => collectionSlug(p.collection) === slug),
    [slug],
  )

  // Derive the display name from the first matching product
  const collectionName = collectionProducts[0]?.collection ?? slugToTitle(slug)

  // Detect section from products to set the right theme
  const section = collectionProducts[0]?.section ?? 'art'
  const isDark   = section === 'objects'

  usePageMeta({
    title:       collectionName,
    description: `Shop the ${collectionName} collection — premium print-on-demand art and wearables. Free worldwide shipping.`,
  })

  useEffect(() => {
    setPageTheme(isDark ? 'dark' : 'light')
    setActiveSection(isDark ? 'objects' : 'art')
    document.body.style.overflow = ''
    if (!isDark) {
      document.documentElement.style.setProperty('color-scheme', 'light')
      document.body.style.backgroundColor = '#f5f0e8'
      document.body.style.color = '#111111'
    }
    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [isDark, setPageTheme, setActiveSection])

  if (collectionProducts.length === 0) {
    return <Navigate to="/art" replace />
  }

  const sorted = useMemo(() => {
    let list = [...collectionProducts]
    if (sortBy === 'price-asc')  list.sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price)
    return list
  }, [collectionProducts, sortBy])

  const bgCls    = isDark ? 'bg-off-black'  : 'bg-paper'
  const textCls  = isDark ? 'text-cream'    : 'text-ink'
  const mutedCls = isDark ? 'text-text-muted' : 'text-ink-muted'
  const borderCls = isDark ? 'border-border' : 'border-paper-border'
  const pillActive = isDark
    ? 'bg-cream text-black border-cream'
    : 'bg-ink text-paper border-ink'
  const cardBg   = isDark ? 'bg-surface' : 'bg-paper-2'
  const imgAspect = isDark ? '1 / 1' : '3 / 4'

  return (
    <div
      className={`min-h-screen w-screen ${bgCls} pt-[84px]`}
      style={!isDark ? { colorScheme: 'light', backgroundColor: '#f5f0e8', color: '#111111' } : {}}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <div className="px-6 sm:px-10 pt-10 pb-6">
        <Link
          to={isDark ? '/objects' : '/art'}
          className={`inline-flex items-center gap-2 text-2xs font-mono tracking-wider uppercase ${mutedCls} hover:${textCls} transition-colors mb-6`}
        >
          <ArrowLeft size={12} /> {isDark ? 'Objects' : 'Art'}
        </Link>
        <h1 className={`font-display text-3xl sm:text-4xl lg:text-5xl ${textCls} leading-tight`}>
          {collectionName}
        </h1>
        <p className={`text-sm ${mutedCls} mt-2`}>{collectionProducts.length} piece{collectionProducts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Sort bar ─────────────────────────────────────── */}
      <div className={`sticky top-[84px] z-20 ${bgCls}/95 backdrop-blur-sm border-b ${borderCls} px-6 sm:px-10 py-3 flex items-center justify-between`}>
        <p className={`text-2xs font-mono tracking-ultra uppercase ${mutedCls}`}>{collectionName}</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={`text-2xs font-mono tracking-wider uppercase bg-transparent ${mutedCls} border ${borderCls} px-2 py-1.5 cursor-pointer focus:outline-none`}
        >
          <option value="default">Sort</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </div>

      {/* ── Grid ─────────────────────────────────────────── */}
      <div className="px-6 sm:px-10 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {sorted.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`} className="group">
              <div className={`relative w-full overflow-hidden ${cardBg} mb-3`} style={{ aspectRatio: imgAspect }}>
                {isNewProduct(product) && (
                  <span className={`absolute top-2 left-2 z-10 text-[9px] font-mono tracking-widest uppercase px-2 py-0.5 ${isDark ? 'bg-cream text-black' : 'bg-ink text-paper'}`}>
                    New
                  </span>
                )}
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
              {product.movement && (
                <p className={`text-2xs font-mono tracking-ultra uppercase ${mutedCls} mb-1`}>
                  {slugToTitle(product.movement)}
                </p>
              )}
              <h3 className={`font-display text-base ${textCls} leading-tight mb-1`}>{product.name}</h3>
              <p className={`text-sm ${mutedCls}`}>from {formatPrice(product.price)}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="h-12" />
    </div>
  )
}
