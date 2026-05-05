import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { products as allProducts } from '@/data/products'
import GenerateAssetsTab from '@/components/GenerateAssetsTab'
import { SOCIAL_LINKS as SOCIAL_LINKS_DEFAULT } from '@/data/social-links'

const ADMIN_PASSWORD = 'jaylpelle'

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const fmt = cents => `€${(cents / 100).toFixed(2)}`
const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

export function parseVideoUrl(url) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return { type: 'vimeo', id: vmMatch[1] }
  if (/\.mp4$/i.test(url)) return { type: 'mp4', src: url }
  return null
}

async function api(action, data) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: ADMIN_PASSWORD, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ── Shared components ─────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-gray-500 text-xs mb-1">{label}</label>
      {children}
      {hint && <p className="text-gray-600 text-xs mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors'
const btnDanger = 'bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors'
const btnGhost = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors'

function Card({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 p-5 space-y-4">
      {title && <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">{title}</h3>}
      {children}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 overflow-y-auto py-8 px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-950 border border-gray-700 w-full max-w-3xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-200 w-7 h-7 flex items-center justify-center text-lg leading-none z-10"
        >
          ×
        </button>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Image Uploader ────────────────────────────────────────────────────────────

function ImageUploader({ files, onChange }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const addFiles = useCallback(raw => {
    onChange(prev => [...prev, ...Array.from(raw)])
  }, [onChange])

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 hover:border-gray-600'}`}
      >
        <p className="text-gray-500 text-sm">Drag & drop images here, or click to browse</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative group flex-shrink-0">
              <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 object-cover border border-gray-700" />
              <button
                onClick={() => onChange(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-red-600 text-white w-5 h-5 text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
              >×</button>
              <p className="text-gray-600 text-xs truncate w-20 mt-0.5">{file.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Collapsible ───────────────────────────────────────────────────────────────

function Collapsible({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1 w-full text-left"
      >
        <span className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
        {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

// ── Add / Edit Product Tab ────────────────────────────────────────────────────

const knownCollections = [...new Set(allProducts.map(p => p.collection).filter(Boolean))]

function AddProductTab({ editingProduct, onSaved, onCancel }) {
  const isEdit = !!editingProduct

  const [gelatoUid, setGelatoUid]   = useState(editingProduct?.gelatoProductId || '')
  const [variants, setVariants]     = useState(editingProduct?.variants || [])
  const [fetching, setFetching]     = useState(false)
  const [fetchErr, setFetchErr]     = useState('')
  const [fetchDebug, setFetchDebug] = useState(null)

  const [title, setTitle]           = useState(editingProduct?.name || '')
  const [price, setPrice]           = useState(editingProduct ? (editingProduct.price / 100).toString() : '')
  const [section, setSection]       = useState(editingProduct?.section || 'objects')
  const [collection, setCollection] = useState(editingProduct?.collection || '')
  const [newColl, setNewColl]       = useState('')
  const [movement, setMovement]     = useState(editingProduct?.movement || '')
  const [description, setDescription] = useState(editingProduct?.description || '')
  const [altText, setAltText]       = useState(editingProduct?.altText || '')
  const [tags, setTags]             = useState(
    Array.isArray(editingProduct?.tags) ? editingProduct.tags.join(', ') : (editingProduct?.tags || '')
  )
  const [videoUrl, setVideoUrl]     = useState(editingProduct?.videoUrl || '')
  const [urgency,          setUrgency]          = useState(editingProduct?.urgency          || '')
  const [relatedProducts,  setRelatedProducts]  = useState(
    Array.isArray(editingProduct?.relatedProducts)
      ? editingProduct.relatedProducts.join(', ')
      : (editingProduct?.relatedProducts || '')
  )

  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr]         = useState('')
  const [personas,   setPersonas]   = useState([])

  // Load personas for asset generation context
  useEffect(() => {
    api('list-personas', {}).then(d => setPersonas(d.personas || [])).catch(() => {})
  }, [])
  const [primaryKeywords,  setPrimaryKeywords]  = useState(
    Array.isArray(editingProduct?.primaryKeywords)  ? editingProduct.primaryKeywords.join(', ')  : (editingProduct?.primaryKeywords || '')
  )
  const [longTailKeywords, setLongTailKeywords] = useState(
    Array.isArray(editingProduct?.longTailKeywords) ? editingProduct.longTailKeywords.join('\n') : (editingProduct?.longTailKeywords || '')
  )
  const [hashtags,         setHashtags]         = useState(editingProduct?.hashtags         || '')
  const [instagramCaption, setInstagramCaption] = useState(editingProduct?.instagramCaption || '')
  const [pinterestCaption, setPinterestCaption] = useState(editingProduct?.pinterestCaption || '')

  // Gelato mockup images (returned from fetch-variants)
  const [gelatoImages, setGelatoImages]   = useState([])   // [{ src, position, variantIds }]
  const [importing, setImporting]         = useState(false)
  const [importedPaths, setImportedPaths] = useState([])   // GitHub paths after import
  const [importMsg, setImportMsg]         = useState('')

  // Existing uploaded images (edit mode) — [{ src, alt }]
  const [existingImages, setExistingImages] = useState(() => {
    const srcs  = editingProduct?.images || []
    const alts  = editingProduct?.imageAlts || {}
    return srcs.map(src => ({ src, alt: alts[src] ?? editingProduct?.altText ?? '' }))
  })

  const [images, setImages]         = useState([])
  const [saving, setSaving]         = useState(false)
  const [saveErr, setSaveErr]       = useState('')
  const [savedMsg, setSavedMsg]     = useState('')
  const [savedProductId, setSavedProductId] = useState(isEdit ? editingProduct.id : null)

  const productId = isEdit ? editingProduct.id : slugify(title)
  const finalCollection = newColl.trim() || collection

  const videoInfo = parseVideoUrl(videoUrl)

  // Map variantId → color label for grouping images
  const variantColorMap = Object.fromEntries(
    variants.filter(v => v.uid && v.color).map(v => [v.uid, v.color])
  )
  // Group Gelato images by color
  const imagesByColor = gelatoImages.reduce((acc, img) => {
    const colors = [...new Set((img.variantIds || []).map(id => variantColorMap[id]).filter(Boolean))]
    const keys = colors.length > 0 ? colors : ['__all__']
    for (const key of keys) {
      if (!acc[key]) acc[key] = []
      acc[key].push(img.src)
    }
    return acc
  }, {})

  const generateWithAI = async () => {
    if (!title.trim()) return setGenErr('Enter a product title first')
    setGenerating(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTitle: title.trim(),
          section,
          collection: newColl.trim() || collection,
          movement: movement.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      if (data.seoTitle)           setTitle(data.seoTitle)
      if (data.description)        setDescription(data.description)
      if (data.altText)            setAltText(data.altText)
      if (data.tags?.length)       setTags(data.tags.join(', '))
      if (data.primaryKeywords?.length)  setPrimaryKeywords(data.primaryKeywords.join(', '))
      if (data.longTailKeywords?.length) setLongTailKeywords(data.longTailKeywords.join('\n'))
      if (data.hashtags)           setHashtags(data.hashtags)
      if (data.instagramCaption)   setInstagramCaption(data.instagramCaption)
      if (data.pinterestCaption)   setPinterestCaption(data.pinterestCaption)
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const fetchVariants = async () => {
    if (!gelatoUid.trim()) return
    setFetching(true); setFetchErr('')
    setGelatoImages([]); setImportedPaths([]); setImportMsg(''); setFetchDebug(null)
    try {
      const res = await fetch(`/api/get-product-variants?productId=${encodeURIComponent(gelatoUid.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fetch failed')

      const fetchedVariants = data.variants || []
      const fetchedImages   = data.images   || []
      setFetchDebug(data._debug ?? null)
      setVariants(fetchedVariants)
      setGelatoImages(fetchedImages)

      // Auto-fill title from Gelato if still empty
      const resolvedTitle = title.trim() || data.title || ''
      if (data.title && !title.trim()) setTitle(data.title)

      // ── Auto-import images immediately (no button needed) ──────────────────
      if (fetchedImages.length > 0) {
        const resolvedId = isEdit
          ? editingProduct.id
          : slugify(resolvedTitle)

        if (resolvedId) {
          setImporting(true)
          setImportMsg(`Importing ${fetchedImages.length} mockups from Gelato…`)

          // Build variantId → color map for SEO filenames
          const vColorMap = Object.fromEntries(
            fetchedVariants.filter(v => v.uid && v.color).map(v => [v.uid, v.color])
          )
          // Resolve color for each image (first associated color, or null)
          const imagesWithColor = fetchedImages.map(img => ({
            src:   img.src,
            color: (img.variantIds || []).map(id => vColorMap[id]).find(Boolean) ?? null,
          }))

          try {
            const importData = await api('import-gelato-images', {
              productId:    resolvedId,
              productTitle: resolvedTitle,
              images:       imagesWithColor,
            })
            const paths = importData.paths || []
            setImportedPaths(paths)
            setImportMsg(`✓ ${paths.length} mockup${paths.length !== 1 ? 's' : ''} imported`)
          } catch (e) {
            setImportMsg(`⚠ Import failed: ${e.message}`)
          } finally {
            setImporting(false)
          }
        } else {
          setImportMsg('⚠ Enter a product title so the images can be saved to the right folder')
        }
      }
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setFetching(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim())       return setSaveErr('Title is required')
    if (!price)              return setSaveErr('Price is required')
    if (!finalCollection)    return setSaveErr('Collection is required')
    if (!isEdit && !productId) return setSaveErr('Cannot generate ID from title')

    setSaving(true); setSaveErr(''); setSavedMsg('')
    try {
      // 1. Start with kept existing images + newly imported Gelato paths
      const keptPaths    = existingImages.map(img => img.src)
      const uploadedPaths = [...keptPaths, ...importedPaths]

      // 2. Upload any manually-added files
      for (const file of images) {
        const dataUrl  = await fileToBase64(file)
        const filename = sanitizeFilename(file.name)
        const result   = await api('upload-image', { productId, filename, dataUrl })
        uploadedPaths.push(result.path)
      }

      // 3. Derive sizes from variants or use default
      const uniqueSizes = [...new Set(variants.map(v => v.size).filter(Boolean))]
      const priceCents  = Math.round(parseFloat(price) * 100)
      const sizes = uniqueSizes.length > 0
        ? uniqueSizes.map(s => ({ id: s, label: s, price: priceCents }))
        : [{ id: 'one-size', label: 'One Size', price: priceCents }]

      // 4. Build colors array from unique variant colors, with per-color image if available
      // imagesByColor: { colorLabel → [gelatoSrc, ...] }
      // importedPaths are named gelato-01.jpg etc in the same order as gelatoImages
      const gelatoSrcToPath = Object.fromEntries(
        gelatoImages.map((img, i) => [img.src, importedPaths[i] ?? null])
      )
      const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))]
      const colorsArray = uniqueColors.length > 0
        ? uniqueColors.map(color => {
            const colorId  = color.toLowerCase().replace(/\s+/g, '-')
            const firstSrc = imagesByColor[color]?.[0] ?? imagesByColor['__all__']?.[0] ?? null
            const img      = firstSrc ? (gelatoSrcToPath[firstSrc] ?? null) : null
            return { id: colorId, label: color, hex: '#888888', ...(img ? { image: img } : {}) }
          })
        : null

      // 5. Build product object
      const product = {
        id: productId,
        section,
        collection: finalCollection,
        name: title.trim(),
        subtitle: finalCollection,
        price: priceCents,
        currency: 'eur',
        description: description.trim() || `${title.trim()} from the ${finalCollection} collection.`,
        altText: altText.trim() || '',
        details: ['Printed and fulfilled via Gelato'],
        sizes,
        image: uploadedPaths[0] || '',
        images: uploadedPaths,
        // Per-image alt texts: merge existing + newly imported (use global altText as fallback)
        imageAlts: Object.fromEntries([
          ...existingImages.map(img => [img.src, img.alt]),
          ...importedPaths.map(p => [p, altText.trim() || '']),
        ].filter(([src, alt]) => src && alt)),
        tags: tags.trim()
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : [slugify(title), slugify(finalCollection)].filter(Boolean),
        featured: false,
        gelatoProductId: gelatoUid.trim() || null,
        movement: movement.trim() || finalCollection,
        adminManaged: true,
        ...(videoUrl.trim()  ? { videoUrl: videoUrl.trim() }   : {}),
        ...(urgency.trim()   ? { urgency:  urgency.trim() }    : {}),
        ...(relatedProducts.trim() ? {
          relatedProducts: relatedProducts.split(',').map(s => s.trim()).filter(Boolean)
        } : {}),
        ...(primaryKeywords.trim()  ? { primaryKeywords:  primaryKeywords.split(',').map(s => s.trim()).filter(Boolean) } : {}),
        ...(longTailKeywords.trim() ? { longTailKeywords: longTailKeywords.split('\n').map(s => s.trim()).filter(Boolean) } : {}),
        ...(hashtags.trim()         ? { hashtags:         hashtags.trim() }         : {}),
        ...(instagramCaption.trim() ? { instagramCaption: instagramCaption.trim() } : {}),
        ...(pinterestCaption.trim() ? { pinterestCaption: pinterestCaption.trim() } : {}),
        ...(variants.length > 0 ? { variants } : {}),
        ...(colorsArray ? { colors: colorsArray } : {}),
      }

      await api('save-product', { product })
      setSavedMsg(`✓ ${isEdit ? 'Updated' : 'Added'}! Vercel deploy will trigger automatically.`)
      setImages([])
      if (!isEdit) setSavedProductId(product.id)
      if (onSaved) onSaved(product)
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {isEdit && (
        <div className="flex items-center justify-between bg-indigo-900/30 border border-indigo-800 px-4 py-2">
          <span className="text-indigo-300 text-sm">Editing: <span className="font-mono">{editingProduct.id}</span></span>
          {onCancel && <button onClick={onCancel} className={btnGhost}>Cancel</button>}
        </div>
      )}

      {/* Gelato */}
      <Card title="Gelato Variants">
        <div className="flex gap-2">
          <input
            value={gelatoUid}
            onChange={e => setGelatoUid(e.target.value.replace(/[^\x20-\x7E]/g, '').trim())}
            placeholder="Gelato Product UID or store product UUID"
            className={inputCls + ' font-mono text-xs'}
          />
          <button onClick={fetchVariants} disabled={fetching || !gelatoUid.trim()} className={btnPrimary + ' whitespace-nowrap'}>
            {fetching ? 'Fetching…' : 'Fetch Variants'}
          </button>
        </div>
        {fetchErr && <p className="text-red-400 text-xs">{fetchErr}</p>}

        {/* Debug panel — shows what Gelato actually returned */}
        {fetchDebug && (
          <Collapsible label={`Debug info`} defaultOpen={false}>
          <div className="bg-gray-800 border border-gray-700 p-3 text-xs font-mono space-y-1">
            <p className="text-gray-400 uppercase tracking-wider text-xs mb-2">Gelato API debug</p>
            <p><span className="text-gray-500">top-level keys:</span> <span className="text-yellow-300">{fetchDebug.topLevelKeys?.join(', ') || '—'}</span></p>
            <p><span className="text-gray-500">rawBody keys:</span> <span className="text-yellow-300">{fetchDebug.rawBodyKeys?.join(', ') || '—'}</span></p>
            <p><span className="text-gray-500">variants:</span> <span className={fetchDebug.variantCount > 0 ? 'text-green-400' : 'text-red-400'}>{fetchDebug.variantCount}</span></p>
            <p><span className="text-gray-500">images found:</span> <span className={fetchDebug.imagesFound > 0 ? 'text-green-400' : 'text-red-400'}>{fetchDebug.imagesFound}</span></p>
            <p><span className="text-gray-500">variant fields:</span> <span className="text-blue-300">{fetchDebug.firstVariantKeys?.join(', ') || '—'}</span></p>
            {fetchDebug.firstVariantPreviewFields && (
              <p><span className="text-gray-500">variant preview fields:</span> <span className="text-blue-300">{JSON.stringify(fetchDebug.firstVariantPreviewFields)}</span></p>
            )}
            {fetchDebug.firstImageEntry?.length > 0 && (
              <p><span className="text-gray-500">first image keys:</span> <span className="text-green-300">{fetchDebug.firstImageEntry.join(', ')}</span></p>
            )}
            {fetchDebug.firstImageFileUrl && (
              <p><span className="text-gray-500">first image URL:</span> <span className="text-cyan-300 break-all">{fetchDebug.firstImageFileUrl}</span></p>
            )}
            {fetchDebug.firstImageVariantIds?.length > 0 && (
              <p><span className="text-gray-500">first image variantIds:</span> <span className="text-cyan-300">{fetchDebug.firstImageVariantIds.join(', ')}</span></p>
            )}
            {fetchDebug.productVariantOptions?.length > 0 && (
              <p><span className="text-gray-500">productVariantOptions:</span> <span className="text-yellow-200">{fetchDebug.productVariantOptions.map(o => `${o.name}(${o.valueCount})`).join(', ')}</span></p>
            )}
            {fetchDebug.sampleVariantResolved && (
              <p><span className="text-gray-500">sample variant resolved:</span> <span className="text-green-300">{JSON.stringify(fetchDebug.sampleVariantResolved)}</span></p>
            )}
            {fetchDebug.firstVariantTitle && (
              <p><span className="text-gray-500">first variant title:</span> <span className="text-purple-300">{fetchDebug.firstVariantTitle}</span></p>
            )}
          </div>
          </Collapsible>
        )}

        {variants.length > 0 && (
          <Collapsible label={`${variants.length} variant${variants.length !== 1 ? 's' : ''} fetched`} defaultOpen={false}>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  {['Size', 'Color', 'Price', 'Variant UID'].map(h => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} className="border-b border-gray-800/40 text-gray-300">
                    <td className="py-1.5 pr-4">{v.size || '—'}</td>
                    <td className="py-1.5 pr-4">{v.color || '—'}</td>
                    <td className="py-1.5 pr-4">{v.price != null ? `€${v.price}` : '—'}</td>
                    <td className="py-1.5 font-mono text-gray-500 text-xs truncate max-w-xs">{v.uid || v.gelatoVariantId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-gray-600 text-xs mt-1">{variants.length} variants fetched</p>
          </div>
          </Collapsible>
        )}
      </Card>

      {/* Gelato Mockup Images — auto-imported on fetch */}
      {(gelatoImages.length > 0 || importing || importMsg) && (
        <Collapsible label={importedPaths.length > 0 ? `${importedPaths.length} mockup${importedPaths.length !== 1 ? 's' : ''} imported` : (importing ? 'Importing mockups…' : 'Gelato Mockups')} defaultOpen={importing}>
        <Card title="Gelato Mockups">
          {/* Status bar */}
          <div className="flex items-center gap-2">
            {importing && (
              <span className="animate-spin inline-block w-3 h-3 border border-indigo-400 border-t-transparent rounded-full flex-shrink-0" />
            )}
            {importMsg && (
              <span className={`text-sm ${
                importMsg.startsWith('✓') ? 'text-green-400'
                : importMsg.startsWith('⚠') ? 'text-yellow-400'
                : 'text-indigo-300'
              }`}>{importMsg}</span>
            )}
          </div>

          {/* Gelato mockup images — horizontal scrollable strip with actual thumbnails */}
          {gelatoImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {gelatoImages.map((img, i) => {
                const imported = i < importedPaths.length && !!importedPaths[i]
                return (
                  <div
                    key={i}
                    className={`flex-shrink-0 relative border ${imported ? 'border-green-600' : 'border-gray-700'}`}
                    style={{ height: 80 }}
                  >
                    <img
                      src={img.src}
                      alt={`Mockup ${i + 1}`}
                      className="h-full w-auto"
                      style={{ display: 'block', minWidth: 48, maxWidth: 120, objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.opacity = '0.3' }}
                    />
                    {imported && (
                      <span className="absolute top-0 right-0 bg-green-900/90 text-green-400 text-xs px-1 leading-5">✓</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {importedPaths.length > 0 && (
            <p className="text-gray-600 text-xs">Le immagini saranno visibili sul sito dopo il deploy Vercel (~2 min).</p>
          )}
        </Card>
        </Collapsible>
      )}

      {/* Info */}
      <Card title="Product Info">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Title" hint={title ? `id: ${slugify(title)}` : ''}>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Snorlax T-Shirt" className={inputCls} />
            </Field>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={generateWithAI}
                disabled={generating || !title.trim()}
                className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors"
              >
                {generating ? (
                  <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />Generating…</>
                ) : (
                  <><span>✨</span>Generate with AI</>
                )}
              </button>
              {genErr && <span className="text-red-400 text-xs">{genErr}</span>}
              {!genErr && !generating && altText && <span className="text-violet-400 text-xs">✓ AI content applied</span>}
            </div>
          </div>

          <Field label="Price (€)">
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="30" className={inputCls} />
          </Field>

          <Field label="Section">
            <select value={section} onChange={e => setSection(e.target.value)} className={inputCls}>
              <option value="objects">objects</option>
              <option value="art">art</option>
            </select>
          </Field>

          <Field label="Collection">
            <select value={collection} onChange={e => { setCollection(e.target.value); setNewColl('') }}
              className={inputCls}>
              <option value="">Select…</option>
              {knownCollections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="New Collection (overrides above)">
            <input value={newColl} onChange={e => setNewColl(e.target.value)}
              placeholder="new-collection-slug" className={inputCls} />
          </Field>

          <Field label="Movement">
            <input value={movement} onChange={e => setMovement(e.target.value)}
              placeholder="Pokemon Cool Logos" className={inputCls} />
          </Field>

          <div className="col-span-2">
            <Field label="Description">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} placeholder="Product description (~150 words)…"
                className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Alt Text (image accessibility)" hint="Used for SEO and screen readers">
              <input value={altText} onChange={e => setAltText(e.target.value)}
                placeholder="Snorlax fan art t-shirt on white background…"
                className={inputCls} />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="⚡ Urgency badge" hint="Shown near Add to Cart — leave empty to hide. e.g. «Only 3 left!» or «Limited edition»">
              <input value={urgency} onChange={e => setUrgency(e.target.value)}
                placeholder="Only 3 left in this colorway!"
                className={inputCls} />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="🛒 Related products (upsell)" hint="Product IDs, comma-separated. Shown as «Complete the look» on the product page.">
              <input value={relatedProducts} onChange={e => setRelatedProducts(e.target.value)}
                placeholder="snorlax-tshirt, snorlax-hoodie, snorlax-tote"
                className={inputCls} />
              {relatedProducts.trim() && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {relatedProducts.split(',').map(s => s.trim()).filter(Boolean).map(rid => {
                    const found = allProducts.find(p => p.id === rid)
                    return (
                      <span key={rid} className={`text-xs px-2 py-0.5 border ${found ? 'border-green-700 text-green-400' : 'border-red-800 text-red-400'}`}>
                        {rid}{found ? '' : ' ✗ not found'}
                      </span>
                    )
                  })}
                </div>
              )}
            </Field>
          </div>

          <div className="col-span-2">
            <Field
              label="Tags"
              hint={`${tags.split(',').filter(t => t.trim()).length}/13 tags · comma-separated`}
            >
              <textarea value={tags} onChange={e => setTags(e.target.value)}
                rows={2} placeholder="snorlax shirt, pokemon gift, anime tee, …"
                className={`${inputCls} resize-none`} />
            </Field>
          </div>
        </div>
      </Card>

      {/* SEO & Social Keywords */}
      <Card title="🔍 SEO & Social (keyword research)">
        <p className="text-gray-500 text-xs mb-4">Generated by AI. Saved to product data — use for copy-pasting to Etsy, IG, Pinterest.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary keywords" hint="Short-tail, high-volume. Comma-separated.">
              <input value={primaryKeywords} onChange={e => setPrimaryKeywords(e.target.value)}
                placeholder="snorlax shirt, anime tee, pokemon fan…"
                className={inputCls} />
            </Field>
            <Field label="Long-tail keywords" hint="One per line. Buying-intent phrases.">
              <textarea value={longTailKeywords} onChange={e => setLongTailKeywords(e.target.value)}
                rows={4} placeholder={"buy snorlax graphic tee online\ngifts for pokemon fans\n…"}
                className={`${inputCls} resize-none text-xs`} />
            </Field>
          </div>
          <Field label="Instagram hashtags" hint="30 hashtags starting with #. Copy-paste to IG.">
            <textarea value={hashtags} onChange={e => setHashtags(e.target.value)}
              rows={3} placeholder="#snorlaxfan #animetee #pokemonfashion …"
              className={`${inputCls} resize-none text-xs`} />
            {hashtags && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(hashtags)}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >📋 Copy hashtags</button>
            )}
          </Field>
          <Field label="Instagram caption" hint="Copy-paste to Instagram.">
            <textarea value={instagramCaption} onChange={e => setInstagramCaption(e.target.value)}
              rows={3} placeholder="Drop everything — this just landed…"
              className={`${inputCls} resize-none text-xs`} />
            {instagramCaption && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(instagramCaption)}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >📋 Copy caption</button>
            )}
          </Field>
          <Field label="Pinterest caption" hint="Copy-paste to Pinterest pin description.">
            <textarea value={pinterestCaption} onChange={e => setPinterestCaption(e.target.value)}
              rows={3} placeholder="Looking for the perfect Pokemon gift?…"
              className={`${inputCls} resize-none text-xs`} />
            {pinterestCaption && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(pinterestCaption)}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >📋 Copy caption</button>
            )}
          </Field>
        </div>
      </Card>

      {/* Video */}
      <Card title="Video (optional)">
        <Field label="Video URL" hint="Accepts YouTube, Vimeo, or direct .mp4 URL. Shown as hero on the product page.">
          <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
            className={inputCls} />
        </Field>
        {videoInfo && (
          <div className="mt-2">
            {videoInfo.type === 'youtube' && (
              <div className="relative w-48">
                <img
                  src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                  alt="Video thumbnail"
                  className="w-full border border-gray-700"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-white text-3xl">▶</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">YouTube · {videoInfo.id}</p>
              </div>
            )}
            {videoInfo.type === 'vimeo' && (
              <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 px-3 py-2 w-48">
                <span className="text-white text-2xl">▶</span>
                <p className="text-gray-400 text-xs">Vimeo · {videoInfo.id}</p>
              </div>
            )}
            {videoInfo.type === 'mp4' && (
              <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block">MP4 video linked</p>
            )}
          </div>
        )}
        {videoUrl && !videoInfo && (
          <p className="text-yellow-500 text-xs mt-1">⚠ URL not recognised as YouTube, Vimeo, or .mp4</p>
        )}
      </Card>

      {/* Images */}
      <Card title="Images">
        {/* Existing uploaded images — editable */}
        {existingImages.length > 0 && (
          <div className="space-y-3">
            <p className="text-gray-500 text-xs">{existingImages.length} image{existingImages.length !== 1 ? 's' : ''} — click × to remove, edit alt text below each</p>
            <div className="space-y-2">
              {existingImages.map((img, i) => (
                <div key={img.src} className="flex gap-3 items-start bg-gray-800/50 border border-gray-800 p-2">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-20 h-20 object-cover border border-gray-700"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextSibling.style.display = 'flex'
                      }}
                    />
                    <div className="w-20 h-20 border border-gray-700 bg-gray-800 hidden items-center justify-center text-gray-600 text-xs text-center p-1">
                      {img.src.split('/').pop()}
                    </div>
                    <button
                      onClick={() => setExistingImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none shadow"
                      title="Remove image"
                    >×</button>
                    <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-gray-400 text-xs px-1 leading-4">{i + 1}</span>
                  </div>
                  {/* Alt text */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-gray-600 text-xs mb-1">Alt text</label>
                    <input
                      value={img.alt}
                      onChange={e => setExistingImages(prev => prev.map((item, j) => j === i ? { ...item, alt: e.target.value } : item))}
                      placeholder="Describe this image for SEO and accessibility…"
                      className={inputCls + ' text-xs'}
                    />
                    <p className="text-gray-700 text-xs mt-1 truncate">{img.src}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload new images */}
        <div>
          <p className="text-gray-500 text-xs mb-2">{existingImages.length > 0 ? 'Aggiungi altre immagini:' : 'Carica immagini:'}</p>
          <ImageUploader files={images} onChange={setImages} />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
          {saving ? 'Saving…' : isEdit ? 'Update Product' : 'Add to Site'}
        </button>
        {(savedProductId || isEdit) && (
          <a
            href={`/product/${productId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnGhost}
          >
            🌐 Preview
          </a>
        )}
        {savedMsg && <span className="text-green-400 text-sm">{savedMsg}</span>}
        {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
      </div>

      {/* Generate Assets — visible as soon as title is entered */}
      {title.trim().length > 2 && (
        <GenerateAssetsTab
          productId={productId}
          productName={title.trim()}
          productType={section === 'art' ? 'art print' : 'apparel/object'}
          primaryColor={variants[0]?.color || (editingProduct?.colors?.[0]?.label) || ''}
          collection={finalCollection}
          onAssetSaved={path => setExistingImages(prev => [...prev, { src: path, alt: '' }])}
          preloadedImages={gelatoImages.map((img, i) => ({ url: img.src, name: img.src.split('/').pop() || `mockup-${i + 1}` }))}
          personas={personas}
          instagramCaption={instagramCaption}
          pinterestCaption={pinterestCaption}
          hashtags={hashtags}
        />
      )}
    </div>
  )
}

// ── Product List Tab ──────────────────────────────────────────────────────────

function ProductsTab({ onEdit }) {
  const navigate = useNavigate()
  const [deletingId,   setDeletingId]   = useState(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [error,        setError]        = useState('')
  const [hidden,       setHidden]       = useState([])
  const [selectedIds,  setSelectedIds]  = useState(new Set())

  const visible     = allProducts.filter(p => !hidden.includes(p.id))
  const allSelected = visible.length > 0 && selectedIds.size === visible.length

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(visible.map(p => p.id)))

  const handleDelete = async product => {
    if (!product.adminManaged) return
    if (!confirm(`Delete "${product.name}"? This will commit to GitHub.`)) return
    setDeletingId(product.id); setError('')
    try {
      await api('delete-product', { productId: product.id })
      setHidden(prev => [...prev, product.id])
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    const targets = visible.filter(p => selectedIds.has(p.id) && p.adminManaged)
    if (!targets.length) return setError('No admin-managed products selected.')
    if (!confirm(`Delete ${targets.length} product${targets.length !== 1 ? 's' : ''}? This will commit to GitHub.`)) return
    setBulkDeleting(true); setError('')
    const failed = []
    for (const p of targets) {
      try {
        await api('delete-product', { productId: p.id })
        setHidden(prev => [...prev, p.id])
        setSelectedIds(prev => { const n = new Set(prev); n.delete(p.id); return n })
      } catch (e) {
        failed.push(p.id)
      }
    }
    setBulkDeleting(false)
    if (failed.length) setError(`Failed to delete: ${failed.join(', ')}`)
  }

  const handleExportCSV = () => {
    const targets = selectedIds.size > 0
      ? visible.filter(p => selectedIds.has(p.id))
      : visible
    const header = ['id','name','price','section','collection','movement','tags']
    const rows   = targets.map(p => [
      p.id, p.name, (p.price / 100).toFixed(2),
      p.section, p.collection, p.movement,
      (p.tags || []).join(';'),
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'jayl-products.csv' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>
      )}

      {/* Bulk action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-gray-600 text-xs">
          {selectedIds.size > 0
            ? <span className="text-indigo-300">{selectedIds.size} selected</span>
            : <span>{visible.length} products</span>}
          {' · click any row to open the product editor'}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {bulkDeleting ? 'Deleting…' : `🗑 Delete ${selectedIds.size}`}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors"
          >
            ⬇ Export CSV{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs font-mono uppercase tracking-wider">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-indigo-500 cursor-pointer"
                  title="Select all"
                />
              </th>
              {['ID', 'Name', 'Price', 'Section', 'Collection', 'Video', 'Images', ''].map(h => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const isSelected = selectedIds.has(p.id)
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/admin/product/${p.id}`)}
                  className={`border-b border-gray-800/40 hover:bg-gray-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-900/10' : ''}`}
                >
                  <td className="px-3 py-3" onClick={e => toggleSelect(p.id, e)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="accent-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{p.id}</td>
                  <td className="px-4 py-3 text-gray-100 whitespace-nowrap font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(p.price)}</td>
                  <td className="px-4 py-3 text-gray-400">{p.section}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{p.collection}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.videoUrl ? <span className="text-indigo-400">▶</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.images?.length || 0}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {p.adminManaged ? (
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/admin/product/${p.id}`)} className={btnGhost}>Edit</button>
                        <button onClick={() => handleDelete(p)} disabled={deletingId === p.id} className={btnDanger}>
                          {deletingId === p.id ? '…' : 'Del'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => navigate(`/admin/product/${p.id}`)} className={btnGhost}>View</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Collections Tab ───────────────────────────────────────────────────────────

function CollectionsTab() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState('#6366f1')

  // Edit-in-place
  const [editingId, setEditingId]   = useState(null)
  const [editName, setEditName]     = useState('')
  const [editColor, setEditColor]   = useState('')

  // Drag-and-drop
  const dragIdx = useRef(null)
  const [draggingOver, setDraggingOver] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await api('list-collections', {})
      setCollections((data.collections || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true); setError('')
    const coll = {
      id: slugify(newName),
      name: newName.trim(),
      color: newColor,
      coverImage: '',
      order: collections.length,
    }
    try {
      await api('save-collection', { collection: coll })
      setCollections(prev => [...prev, coll])
      setNewName('')
      setNewColor('#6366f1')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async coll => {
    if (!confirm(`Delete collection "${coll.name}"?`)) return
    setError('')
    try {
      await api('delete-collection', { collectionId: coll.id })
      setCollections(prev => prev.filter(c => c.id !== coll.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const startEdit = coll => {
    setEditingId(coll.id)
    setEditName(coll.name)
    setEditColor(coll.color || '#6366f1')
  }

  const handleSaveEdit = async coll => {
    const updated = { ...coll, name: editName.trim() || coll.name, color: editColor }
    setError('')
    try {
      await api('save-collection', { collection: updated })
      setCollections(prev => prev.map(c => c.id === coll.id ? updated : c))
      setEditingId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  // Drag handlers
  const handleDragStart = idx => { dragIdx.current = idx }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    setDraggingOver(idx)
    if (dragIdx.current === null || dragIdx.current === idx) return
    const reordered = [...collections]
    const [moved] = reordered.splice(dragIdx.current, 1)
    reordered.splice(idx, 0, moved)
    dragIdx.current = idx
    setCollections(reordered)
  }

  const handleDragEnd = async () => {
    setDraggingOver(null)
    dragIdx.current = null
    const reordered = collections.map((c, i) => ({ ...c, order: i }))
    setCollections(reordered)
    try {
      await api('reorder-collections', { collections: reordered })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {error && (
        <div className="bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>
      )}

      {/* Create */}
      <Card title="Create Collection">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Field label="Name">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Pokemon Cool Logos"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex-shrink-0 pb-0.5">
            <label className="block text-gray-500 text-xs mb-1">Color</label>
            <input
              type="color"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="w-10 h-9 cursor-pointer bg-gray-800 border border-gray-700 p-0.5 block"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className={btnPrimary + ' flex-shrink-0 pb-0.5'}
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
        {newName && (
          <p className="text-gray-600 text-xs">id will be: <span className="font-mono">{slugify(newName)}</span></p>
        )}
      </Card>

      {/* List */}
      <Card title="Collections — drag to reorder">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading from GitHub…</p>
        ) : collections.length === 0 ? (
          <p className="text-gray-600 text-sm">No collections yet. Create one above.</p>
        ) : (
          <div className="space-y-1.5">
            {collections.map((coll, i) => (
              <div
                key={coll.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 border px-3 py-2.5 transition-colors ${
                  draggingOver === i ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                {/* Drag handle */}
                <span className="text-gray-600 text-sm select-none cursor-grab active:cursor-grabbing flex-shrink-0">⠿</span>

                {/* Color swatch */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-600"
                  style={{ backgroundColor: coll.color || '#888' }}
                />

                {editingId === coll.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 text-white px-2 py-1 text-sm focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="w-7 h-7 cursor-pointer bg-transparent border border-gray-600 p-0 rounded flex-shrink-0"
                    />
                    <button onClick={() => handleSaveEdit(coll)} className={btnPrimary + ' py-1 text-xs'}>Save</button>
                    <button onClick={() => setEditingId(null)} className={btnGhost}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="text-gray-200 text-sm flex-1 min-w-0 truncate">{coll.name}</span>
                    <span className="text-gray-600 text-xs font-mono hidden sm:block flex-shrink-0">{coll.id}</span>
                    <button onClick={() => startEdit(coll)} className={btnGhost}>Rename</button>
                    <button onClick={() => handleDelete(coll)} className={btnDanger}>Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {collections.length > 0 && (
          <p className="text-gray-600 text-xs">{collections.length} collection{collections.length !== 1 ? 's' : ''} · changes save to GitHub automatically</p>
        )}
      </Card>
    </div>
  )
}

// ── Image Manager Tab ─────────────────────────────────────────────────────────

function ImagesTab() {
  const [selectedId, setSelectedId] = useState(allProducts[0]?.id || '')
  const [ghImages, setGhImages]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [newFiles, setNewFiles]     = useState([])
  const [uploading, setUploading]   = useState(false)

  const load = async id => {
    setLoading(true); setError(''); setGhImages([])
    try {
      const data = await api('list-images', { productId: id })
      setGhImages(data.images || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (selectedId) load(selectedId) }, [selectedId])

  const handleDelete = async img => {
    if (!confirm(`Delete ${img.name}?`)) return
    setError('')
    try {
      await api('delete-image', { path: img.path, sha: img.sha })
      setGhImages(prev => prev.filter(i => i.sha !== img.sha))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleUpload = async () => {
    setUploading(true); setError('')
    try {
      for (const file of newFiles) {
        const dataUrl  = await fileToBase64(file)
        const filename = sanitizeFilename(file.name)
        await api('upload-image', { productId: selectedId, filename, dataUrl })
      }
      setNewFiles([])
      await load(selectedId)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const product = allProducts.find(p => p.id === selectedId)

  return (
    <div className="space-y-5 max-w-3xl">
      <Card title="Select Product">
        <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setNewFiles([]) }}
          className={inputCls + ' max-w-sm'}>
          {allProducts.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.id}</option>
          ))}
        </select>
        {product && (
          <p className="text-gray-600 text-xs">
            products.js images array: {product.images?.length || 0} entries
          </p>
        )}
      </Card>

      <Card title="GitHub Images">
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading from GitHub…</p>
        ) : ghImages.length > 0 ? (
          <div>
            <p className="text-gray-500 text-xs mb-3">
              {ghImages.length} files in <span className="font-mono">public/images/{selectedId}/</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {ghImages.map(img => (
                <div key={img.sha} className="group relative flex-shrink-0">
                  <img src={img.url} alt={img.name}
                    className="w-24 h-24 object-cover border border-gray-700"
                    onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                  <button onClick={() => handleDelete(img)}
                    className="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                    ×
                  </button>
                  <p className="text-gray-600 text-xs truncate w-24 mt-1">{img.name}</p>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && (
          <p className="text-gray-600 text-sm">No images found in <span className="font-mono">public/images/{selectedId}/</span></p>
        )}
      </Card>

      <Card title="Upload New Images">
        <ImageUploader files={newFiles} onChange={setNewFiles} />
        {newFiles.length > 0 && (
          <button onClick={handleUpload} disabled={uploading} className={btnPrimary}>
            {uploading ? 'Uploading…' : `Upload ${newFiles.length} image${newFiles.length > 1 ? 's' : ''} to GitHub`}
          </button>
        )}
      </Card>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const submit = e => {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('adminAuth', '1'); onLogin() }
    else setErr('Incorrect password')
  }
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <form onSubmit={submit} className="bg-gray-900 border border-gray-800 p-8 w-80 space-y-4">
        <div>
          <p className="text-gray-500 text-xs font-mono tracking-widest uppercase mb-1">JAYL</p>
          <h1 className="text-white text-xl font-semibold">Admin Panel</h1>
        </div>
        <input type="password" placeholder="Password" value={pw} autoFocus
          onChange={e => { setPw(e.target.value); setErr('') }}
          className={inputCls} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button type="submit" className={`${btnPrimary} w-full py-2.5`}>Enter</button>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Personas Tab ─────────────────────────────────────────────────────────────

const slugifyId = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function PersonaForm({ initial, onSave, onCancel }) {
  const isNew = !initial?.id
  const [name,           setName]           = useState(initial?.name           || '')
  const [handle,         setHandle]         = useState(initial?.handle         || '')
  const [bio,            setBio]            = useState(initial?.bio            || '')
  const [personality,    setPersonality]    = useState(initial?.personality    || '')
  const [aesthetic,      setAesthetic]      = useState(initial?.aesthetic      || '')
  const [contentStyle,   setContentStyle]   = useState(initial?.contentStyle   || '')
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience || '')
  const [promptContext,  setPromptContext]  = useState(initial?.promptContext  || '')
  const [instagram,      setInstagram]      = useState(initial?.instagram      || '')
  const [tiktok,         setTikTok]         = useState(initial?.tiktok         || '')
  const [youtube,        setYoutube]        = useState(initial?.youtube        || '')
  const [refImages,      setRefImages]      = useState(initial?.referenceImages || [])

  const [seed,       setSeed]       = useState('')
  const [generating, setGenerating] = useState(false)
  const [genErr,     setGenErr]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveErr,    setSaveErr]    = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)
  const refInputRef = useRef()

  const personaId = initial?.id || slugifyId(name)

  const handleGenerate = async () => {
    if (!seed.trim() && !name.trim()) return setGenErr('Enter a name or seed description')
    setGenerating(true); setGenErr('')
    try {
      const res  = await fetch('/api/generate-persona', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seed.trim() || name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      if (data.name)           setName(data.name)
      if (data.handle)         setHandle(data.handle)
      if (data.bio)            setBio(data.bio)
      if (data.personality)    setPersonality(data.personality)
      if (data.aesthetic)      setAesthetic(data.aesthetic)
      if (data.contentStyle)   setContentStyle(data.contentStyle)
      if (data.targetAudience) setTargetAudience(data.targetAudience)
      if (data.promptContext)  setPromptContext(data.promptContext)
    } catch (e) { setGenErr(e.message) }
    finally { setGenerating(false) }
  }

  const handleRefUpload = async (file) => {
    if (!personaId) return
    setUploadingImg(true)
    try {
      const dataUrl  = await fileToBase64(file)
      const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()
      const result   = await api('upload-persona-image', { personaId, filename, dataUrl })
      setRefImages(prev => [...prev, result.path])
    } catch (e) { setSaveErr(e.message) }
    finally { setUploadingImg(false) }
  }

  const handleSave = async () => {
    if (!name.trim()) return setSaveErr('Name is required')
    setSaving(true); setSaveErr('')
    try {
      const persona = {
        id: personaId,
        name: name.trim(), handle: handle.trim(), bio: bio.trim(),
        personality: personality.trim(), aesthetic: aesthetic.trim(),
        contentStyle: contentStyle.trim(), targetAudience: targetAudience.trim(),
        promptContext: promptContext.trim(),
        instagram: instagram.trim(), tiktok: tiktok.trim(), youtube: youtube.trim(),
        referenceImages: refImages,
        ...(initial?.createdAt ? { createdAt: initial.createdAt } : {}),
      }
      await api('save-persona', { persona })
      onSave(persona)
    } catch (e) { setSaveErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold">{isNew ? 'New Persona' : `Edit: ${initial.name}`}</h3>
        <button onClick={onCancel} className={btnGhost}>← Back</button>
      </div>

      {/* AI seed */}
      <Card title="✨ Generate with AI">
        <p className="text-gray-500 text-xs mb-3">Describe the influencer vibe — GPT will generate the full identity.</p>
        <div className="flex gap-2">
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="e.g. dark aesthetic anime girl from Tokyo, loves streetwear and art prints"
            className={inputCls + ' flex-1'}
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors"
          >
            {generating ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                Generating…
              </span>
            ) : '✨ Generate'}
          </button>
        </div>
        {genErr && <p className="text-red-400 text-xs mt-2">{genErr}</p>}
      </Card>

      {/* Identity */}
      <Card title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" hint={name ? `id: ${personaId}` : ''}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Luna" className={inputCls} />
          </Field>
          <Field label="Handle">
            <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@luna.aesthetic" className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="Bio" hint="Max 150 chars — shown as Instagram bio style">
              <input value={bio} onChange={e => setBio(e.target.value)} maxLength={150} placeholder="Digital art lover 🖤 Anime × streetwear" className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">{bio.length}/150</p>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Personality">
              <textarea value={personality} onChange={e => setPersonality(e.target.value)} rows={2}
                placeholder="Edgy, minimalist, never hypes products directly…" className={`${inputCls} resize-none`} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Visual aesthetic">
              <textarea value={aesthetic} onChange={e => setAesthetic(e.target.value)} rows={2}
                placeholder="Dark moody tones, high contrast, neon accents…" className={`${inputCls} resize-none`} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Content style">
              <textarea value={contentStyle} onChange={e => setContentStyle(e.target.value)} rows={2}
                placeholder="Short punchy captions, outfit fits, reels with lo-fi music…" className={`${inputCls} resize-none`} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Target audience">
              <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                placeholder="Gen-Z anime fans, 17-26, streetwear community" className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="AI prompt context" hint="Compact style descriptor injected into image generation prompts">
              <input value={promptContext} onChange={e => setPromptContext(e.target.value)}
                placeholder="dark moody aesthetic, high contrast, urban, cinematic" className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Social */}
      <Card title="Social Channels">
        <div className="space-y-3">
          <Field label="Instagram URL">
            <input value={instagram} onChange={e => setInstagram(e.target.value)}
              placeholder="https://instagram.com/luna.aesthetic" className={inputCls} />
          </Field>
          <Field label="TikTok URL">
            <input value={tiktok} onChange={e => setTikTok(e.target.value)}
              placeholder="https://tiktok.com/@luna.aesthetic" className={inputCls} />
          </Field>
          <Field label="YouTube URL">
            <input value={youtube} onChange={e => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@lunaesthetic" className={inputCls} />
          </Field>
        </div>
      </Card>

      {/* Reference images */}
      <Card title="Reference Images">
        <p className="text-gray-500 text-xs mb-3">Upload 2–5 photos that define this persona's look. Used as visual context in the Generate Assets tab.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {refImages.map((src, i) => (
            <div key={src} className="relative group">
              <img src={src} alt={`ref-${i + 1}`} className="w-20 h-20 object-cover border border-gray-700" />
              <button
                onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none shadow opacity-0 group-hover:opacity-100 transition-opacity"
              >×</button>
            </div>
          ))}
          {uploadingImg && (
            <div className="w-20 h-20 border border-gray-700 flex items-center justify-center">
              <span className="animate-spin w-4 h-4 border border-indigo-400 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
        <div>
          <input
            ref={refInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => Array.from(e.target.files).forEach(handleRefUpload)}
          />
          {!personaId ? (
            <p className="text-yellow-400 text-xs">Enter a name first to enable image upload.</p>
          ) : (
            <button
              onClick={() => refInputRef.current?.click()}
              disabled={uploadingImg}
              className={btnGhost}
            >
              {uploadingImg ? 'Uploading…' : '+ Add reference images'}
            </button>
          )}
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
          {saving ? 'Saving…' : isNew ? 'Create Persona' : 'Update Persona'}
        </button>
        <button onClick={onCancel} className={btnGhost}>Cancel</button>
        {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
      </div>
    </div>
  )
}

function PersonasTab() {
  const [personas, setPersonas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null) // null = list, {} = new, {persona} = edit
  const [deleting, setDeleting] = useState(null)
  const [error,    setError]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('list-personas', {})
      setPersonas(data.personas || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this persona permanently?')) return
    setDeleting(id)
    try {
      await api('delete-persona', { personaId: id })
      setPersonas(prev => prev.filter(p => p.id !== id))
    } catch (e) { setError(e.message) }
    finally { setDeleting(null) }
  }

  const handleSaved = (persona) => {
    setPersonas(prev => {
      const idx = prev.findIndex(p => p.id === persona.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = persona; return next }
      return [...prev, persona]
    })
    setEditing(null)
  }

  if (editing !== null) {
    return (
      <PersonaForm
        initial={editing.id ? editing : undefined}
        onSave={handleSaved}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-sm font-semibold">Influencer Personas</h2>
          <p className="text-gray-500 text-xs mt-0.5">AI-generated virtual influencers. Used in asset generation and publishing.</p>
        </div>
        <button onClick={() => setEditing({})} className={btnPrimary + ' text-xs py-1.5'}>+ New Persona</button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading personas…</p>}

      {!loading && personas.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 p-10 text-center space-y-3">
          <p className="text-gray-500 text-sm">No personas yet.</p>
          <p className="text-gray-600 text-xs">Create your first AI-generated influencer persona to use in content creation.</p>
          <button onClick={() => setEditing({})} className={btnPrimary + ' mx-auto block text-xs py-1.5 mt-2'}>
            Create first persona
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              {p.referenceImages?.[0] ? (
                <img src={p.referenceImages[0]} alt={p.name} className="w-14 h-14 rounded-full object-cover border-2 border-gray-700 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-2xl flex-shrink-0">
                  {p.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">{p.name}</p>
                <p className="text-gray-500 text-xs">{p.handle}</p>
                <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{p.bio}</p>
              </div>
            </div>

            {/* Reference images strip */}
            {p.referenceImages?.length > 1 && (
              <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {p.referenceImages.slice(1).map((src, i) => (
                  <img key={i} src={src} alt="" className="w-10 h-10 object-cover border border-gray-800 flex-shrink-0" />
                ))}
              </div>
            )}

            {/* Social icons */}
            <div className="flex gap-2 flex-wrap">
              {p.instagram && <a href={p.instagram} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-0.5 border border-pink-900/60 text-pink-400 hover:border-pink-700 transition-colors">IG</a>}
              {p.tiktok    && <a href={p.tiktok}    target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-0.5 border border-gray-700 text-gray-400 hover:border-gray-500 transition-colors">TT</a>}
              {p.youtube   && <a href={p.youtube}   target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-0.5 border border-red-900/60 text-red-400 hover:border-red-700 transition-colors">YT</a>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(p)} className={btnGhost + ' flex-1 text-center'}>Edit</button>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deleting === p.id}
                className={btnDanger}
              >{deleting === p.id ? '…' : '🗑'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

// ── Reviews Tab ───────────────────────────────────────────────────────────────

const STAR = '★'
const STAR_EMPTY = '☆'

function StarDisplay({ rating, size = 14 }) {
  return (
    <span className="text-yellow-400" style={{ fontSize: size }}>
      {Array.from({ length: 5 }, (_, i) => i < rating ? STAR : STAR_EMPTY).join('')}
    </span>
  )
}

function ReviewsTab() {
  const [reviews, setReviews]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error,   setError]       = useState('')
  const [filter,  setFilter]      = useState('pending') // 'all' | 'pending' | 'approved' | 'rejected'
  const [acting,  setActing]      = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await api('list-reviews', {})
      setReviews(data.reviews || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const moderate = async (reviewId, decision) => {
    setActing(reviewId + decision)
    try {
      await api('moderate-review', { reviewId, decision })
      await load()
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  const visible = reviews.filter(r => filter === 'all' ? true : r.status === filter)

  const pendingCount = reviews.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filter === f ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-yellow-500 text-black text-xs w-4 h-4 rounded-full inline-flex items-center justify-center font-bold">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={load} className={btnGhost}>{loading ? 'Loading…' : '↻ Refresh'}</button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && visible.length === 0 && (
        <p className="text-gray-500 text-sm py-8 text-center">No {filter === 'all' ? '' : filter} reviews.</p>
      )}

      <div className="space-y-3">
        {visible.map(r => (
          <div key={r.id} className={`bg-gray-900 border p-4 space-y-2 ${r.status === 'pending' ? 'border-yellow-800/50' : r.status === 'approved' ? 'border-green-900/50' : 'border-gray-800'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <StarDisplay rating={r.rating} />
                  <span className="text-white text-sm font-medium">{r.author}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === 'pending' ? 'bg-yellow-900/60 text-yellow-400' : r.status === 'approved' ? 'bg-green-900/60 text-green-400' : 'bg-gray-800 text-gray-500'}`}>{r.status}</span>
                </div>
                <p className="text-gray-500 text-xs">{r.productId} · {new Date(r.createdAt).toLocaleDateString('it-IT')}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {r.status !== 'approved' && (
                  <button
                    onClick={() => moderate(r.id, 'approve')}
                    disabled={!!acting}
                    className="bg-green-800 hover:bg-green-700 disabled:opacity-40 text-white px-2.5 py-1 text-xs transition-colors"
                  >{acting === r.id + 'approve' ? '…' : '✓ Approve'}</button>
                )}
                {r.status !== 'rejected' && (
                  <button
                    onClick={() => moderate(r.id, 'reject')}
                    disabled={!!acting}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-2.5 py-1 text-xs transition-colors"
                  >{acting === r.id + 'reject' ? '…' : '✗ Reject'}</button>
                )}
                <button
                  onClick={() => { if (confirm('Delete this review permanently?')) moderate(r.id, 'delete') }}
                  disabled={!!acting}
                  className="bg-red-900 hover:bg-red-800 disabled:opacity-40 text-white px-2.5 py-1 text-xs transition-colors"
                >{acting === r.id + 'delete' ? '…' : '🗑'}</button>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

function OrdersTab() {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/get-orders?page=${p}&limit=20`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load orders')
      if (p === 1) setOrders(data.orders || [])
      else setOrders(prev => [...prev, ...(data.orders || [])])
      setHasMore(data.hasMore || false)
      setPage(p)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [])

  const STATUS_COLOR = {
    created:    'text-blue-400',
    passed:     'text-yellow-400',
    printed:    'text-purple-400',
    shipped:    'text-green-400',
    delivered:  'text-green-300',
    cancelled:  'text-red-400',
    draft:      'text-gray-500',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Gelato Orders</h2>
        <button onClick={() => load(1)} className={btnGhost}>{loading && page === 1 ? 'Loading…' : '↻ Refresh'}</button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && orders.length === 0 && !error && (
        <p className="text-gray-500 text-sm py-8 text-center">No orders yet.</p>
      )}

      {orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4 font-medium">Order ID</th>
                <th className="text-left py-2 pr-4 font-medium">Date</th>
                <th className="text-left py-2 pr-4 font-medium">Customer</th>
                <th className="text-left py-2 pr-4 font-medium">Status</th>
                <th className="text-left py-2 pr-4 font-medium">Items</th>
                <th className="text-right py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{o.id?.slice(0, 12)}…</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300 text-xs">
                    {o.shippingAddress?.firstName} {o.shippingAddress?.lastName}
                    {o.shippingAddress?.country && <span className="text-gray-600 ml-1">· {o.shippingAddress.country}</span>}
                  </td>
                  <td className={`py-2.5 pr-4 text-xs font-medium capitalize ${STATUS_COLOR[o.status] || 'text-gray-400'}`}>
                    {o.status || '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs">{o.items?.length ?? '—'}</td>
                  <td className="py-2.5 text-right text-gray-300 text-xs tabular-nums">
                    {o.totalPrice != null ? `€${(o.totalPrice / 100).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button onClick={() => load(page + 1)} disabled={loading}
          className={btnGhost + ' w-full text-center'}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const [instagram, setInstagram] = useState(SOCIAL_LINKS_DEFAULT?.instagram || '')
  const [tiktok,    setTikTok]    = useState(SOCIAL_LINKS_DEFAULT?.tiktok    || '')
  const [pinterest, setPinterest] = useState(SOCIAL_LINKS_DEFAULT?.pinterest || '')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [emails,    setEmails]    = useState(null)
  const [emailsLoading, setEmailsLoading] = useState(false)

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      await api('save-social-links', { links: { instagram, tiktok, pinterest } })
      setMsg('✓ Saved — Vercel will deploy in ~2 min')
    } catch (e) {
      setMsg(`⚠ ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const loadEmails = async () => {
    setEmailsLoading(true)
    try {
      const data = await api('list-emails', {})
      setEmails(data.emails || [])
    } catch { setEmails([]) }
    finally { setEmailsLoading(false) }
  }

  const exportEmails = () => {
    if (!emails?.length) return
    const csv = 'email,subscribedAt\n' + emails.map(e => `${e.email},${e.subscribedAt}`).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'jayl-subscribers.csv'
    a.click()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card title="Social Links">
        <p className="text-gray-500 text-xs mb-4">
          These links appear as icons in the top navbar (desktop) and mobile menu.
          Saving commits the file to GitHub and triggers a Vercel deploy (~2 min).
        </p>
        <div className="space-y-3">
          <Field label="Instagram">
            <input value={instagram} onChange={e => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourhandle" className={inputCls} />
          </Field>
          <Field label="TikTok">
            <input value={tiktok} onChange={e => setTikTok(e.target.value)}
              placeholder="https://tiktok.com/@yourhandle" className={inputCls} />
          </Field>
          <Field label="Pinterest">
            <input value={pinterest} onChange={e => setPinterest(e.target.value)}
              placeholder="https://pinterest.com/yourhandle" className={inputCls} />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2 text-xs font-semibold tracking-wide transition-colors"
          >
            {saving ? 'Saving…' : 'Save Social Links'}
          </button>
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>{msg}</span>}
        </div>
      </Card>

      <Card title="📧 Newsletter Subscribers">
        <p className="text-gray-500 text-xs mb-4">
          Emails captured via the 10%-off popup. Stored in <code className="text-gray-400">src/data/emails.json</code>.
        </p>
        <div className="flex gap-2 mb-4">
          <button onClick={loadEmails} disabled={emailsLoading} className={btnPrimary}>
            {emailsLoading ? 'Loading…' : 'Load subscribers'}
          </button>
          {emails?.length > 0 && (
            <button onClick={exportEmails} className={btnGhost}>⬇ Export CSV</button>
          )}
        </div>
        {emails !== null && (
          emails.length === 0
            ? <p className="text-gray-500 text-xs">No subscribers yet.</p>
            : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {emails.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800">
                    <span className="text-gray-300">{e.email}</span>
                    <span className="text-gray-600">{new Date(e.subscribedAt).toLocaleDateString('it-IT')}</span>
                  </div>
                ))}
                <p className="text-gray-600 text-xs pt-2">{emails.length} subscriber{emails.length !== 1 ? 's' : ''}</p>
              </div>
            )
        )}
      </Card>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed]           = useState(() => sessionStorage.getItem('adminAuth') === '1')
  const [tab, setTab]                 = useState('products')
  const [editingProduct, setEditingProduct] = useState(null)   // modal state

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const handleEdit   = product => setEditingProduct(product)
  const handleSaved  = ()      => setEditingProduct(null)
  const handleCancel = ()      => setEditingProduct(null)
  const logout       = ()      => { sessionStorage.removeItem('adminAuth'); setAuthed(false) }

  const tabs = [
    { id: 'products',     label: 'Products' },
    { id: 'add',          label: 'Add Product' },
    { id: 'collections',  label: 'Collections' },
    { id: 'images',       label: 'Images' },
    { id: 'personas',     label: '🎭 Personas' },
    { id: 'reviews',      label: '⭐ Reviews' },
    { id: 'orders',       label: '📦 Orders' },
    { id: 'settings',     label: '⚙ Settings' },
  ]

  return (
    <>
      {/* ── Edit modal (floats over any tab) ── */}
      <Modal open={!!editingProduct} onClose={handleCancel}>
        {editingProduct && (
          <AddProductTab
            editingProduct={editingProduct}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}
      </Modal>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <span className="text-white font-semibold text-sm tracking-wide">JAYL Admin</span>
              <nav className="flex gap-0.5">
                {tabs.map(t => (
                  <button key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      tab === t.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
            <button onClick={logout} className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              Logout
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          {tab === 'products'    && <ProductsTab onEdit={handleEdit} />}
          {tab === 'add'         && <AddProductTab onSaved={() => setTab('products')} />}
          {tab === 'collections' && <CollectionsTab />}
          {tab === 'images'      && <ImagesTab />}
          {tab === 'personas'    && <PersonasTab />}
          {tab === 'reviews'     && <ReviewsTab />}
          {tab === 'orders'      && <OrdersTab />}
          {tab === 'settings'    && <SettingsTab />}
        </main>
      </div>
    </>
  )
}
