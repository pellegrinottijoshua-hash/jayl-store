import { useState, useMemo } from 'react'
import SitoPanel       from './generate-assets/SitoPanel'
import SocialPanel     from './generate-assets/SocialPanel'
import InfluencerPanel from './generate-assets/InfluencerPanel'
export { IMAGE_MODELS, VIDEO_MODELS } from './generate-assets/constants'

export default function GenerateAssetsTab({
  productId, productName, productType, primaryColor, collection,
  onAssetSaved, preloadedImages, personas,
}) {
  const [mobileSection, setMobileSection] = useState('sito')

  // allImages comes directly from the parent (AdminProductPage) which already
  // merges Gelato defaults + uploaded + generated from GitHub.
  const allImages = useMemo(() => {
    const seen = new Set()
    const out  = []
    for (const img of (preloadedImages || [])) {
      if (!img.url || seen.has(img.url)) continue
      seen.add(img.url)
      out.push({ url: img.url, name: img.name || img.url.split('/').pop() || 'image' })
    }
    return out
  }, [(preloadedImages || []).map(i => i.url).join(',')]) // eslint-disable-line

  // ── Mobile section tabs ──────────────────────────────────────────────────
  const mobileTabs = [
    { id: 'sito',       label: '🌐 Sito'       },
    { id: 'social',     label: '📣 Social'     },
    { id: 'influencer', label: '👤 Influencer' },
  ]

  return (
    <div className="bg-gray-950 border border-indigo-900/40 space-y-0">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
        <h3 className="text-indigo-400 text-xs font-mono uppercase tracking-widest font-semibold">
          ✨ Generate Assets
        </h3>
        {allImages.length > 0 && (
          <span className="text-gray-600 text-xs">{allImages.length} reference image{allImages.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Mobile section toggle ───────────────────────────────────────── */}
      <div className="flex lg:hidden border-b border-gray-800">
        {mobileTabs.map(t => (
          <button key={t.id} onClick={() => setMobileSection(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobileSection === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — SITO (full width)
          Image mockups, hero images and video for the website
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={mobileSection !== 'sito' ? 'hidden lg:block' : ''}>
        <div className="px-5 py-2 border-b border-gray-800 bg-gray-900/40">
          <span className="text-blue-400 text-xs font-mono uppercase tracking-widest font-semibold">🌐 Sito</span>
          <span className="text-gray-600 text-xs ml-3">Mockup · Hero · Video per il sito</span>
        </div>
        <SitoPanel
          productId={productId}
          productName={productName}
          productType={productType}
          primaryColor={primaryColor}
          collection={collection}
          allImages={allImages}
          onAssetSaved={onAssetSaved}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2+3 — SOCIAL + INFLUENCER (two columns)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row border-t border-gray-800">

        {/* SOCIAL column */}
        <div className={`flex-1 min-w-0 lg:border-r border-gray-800 ${mobileSection !== 'social' ? 'hidden lg:block' : ''}`}>
          <div className="px-5 py-2 border-b border-gray-800 bg-gray-900/40">
            <span className="text-pink-400 text-xs font-mono uppercase tracking-widest font-semibold">📣 Social JAYL</span>
            <span className="text-gray-600 text-xs ml-3">Prompt per ogni piattaforma</span>
          </div>
          <SocialPanel
            productId={productId}
            productName={productName}
            productType={productType}
            primaryColor={primaryColor}
            collection={collection}
            allImages={allImages}
            onAssetSaved={onAssetSaved}
          />
        </div>

        {/* INFLUENCER column */}
        <div className={`flex-1 min-w-0 ${mobileSection !== 'influencer' ? 'hidden lg:block' : ''}`}>
          <div className="px-5 py-2 border-b border-gray-800 bg-gray-900/40">
            <span className="text-purple-400 text-xs font-mono uppercase tracking-widest font-semibold">👤 Influencer</span>
          </div>
          <InfluencerPanel
            personas={personas || []}
            productId={productId}
            productName={productName}
            allImages={allImages}
            onAssetSaved={onAssetSaved}
          />
        </div>

      </div>
    </div>
  )
}
