import { useState, useEffect } from 'react'
import SitoPanel       from './generate-assets/SitoPanel'
import InfluencerPanel from './generate-assets/InfluencerPanel'
import { api } from './generate-assets/constants'

export { IMAGE_MODELS, VIDEO_MODELS } from './generate-assets/constants'

export default function GenerateAssetsTab({
  productId, productName, productType, primaryColor, collection,
  onAssetSaved, preloadedImages, personas,
  instagramCaption, pinterestCaption, hashtags,
}) {
  const [mobileTab,     setMobileTab]     = useState('sito')
  const [productImages, setProductImages] = useState([])

  useEffect(() => {
    if (!productId) return
    api('list-images', { productId })
      .then(data => {
        const imgs = (data.images || []).filter(i => !/generated\//.test(i.path))
        setProductImages(imgs)
      })
      .catch(() => {})
  }, [productId])

  const normalizedPreloaded = (preloadedImages || []).map(img => ({
    url:  img.url,
    name: img.name || img.url.split('/').pop() || 'image',
  }))
  const allImages = productImages.length > 0 ? productImages : normalizedPreloaded

  return (
    <div className="border border-indigo-900/50 bg-gray-950">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-indigo-400 text-xs font-mono uppercase tracking-widest">✨ Generate Assets</h3>
      </div>

      {/* Mobile tab toggle */}
      <div className="flex lg:hidden border-b border-gray-800">
        {[
          { id: 'sito',       label: '🌐 Sito'       },
          { id: 'influencer', label: '👤 Influencer' },
        ].map(t => (
          <button key={t.id} onClick={() => setMobileTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobileTab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row min-h-0">
        {/* SITO column */}
        <div className={`flex-1 min-w-0 lg:border-r border-gray-800 ${mobileTab !== 'sito' ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
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

        {/* INFLUENCER column */}
        <div className={`flex-1 min-w-0 ${mobileTab !== 'influencer' ? 'hidden lg:block' : ''}`}>
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
