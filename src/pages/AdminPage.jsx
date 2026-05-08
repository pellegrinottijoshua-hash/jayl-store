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
  const [printCost,        setPrintCost]        = useState(editingProduct?.printCost ? (editingProduct.printCost / 100).toString() : '')
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
        ...(printCost.trim() ? { printCost: Math.round(parseFloat(printCost) * 100) } : {}),
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

          <Field label="Print Cost (€)" hint="Gelato cost per unit — used for margin analytics">
            <input type="number" min="0" step="0.01" value={printCost} onChange={e => setPrintCost(e.target.value)}
              placeholder="8.50" className={inputCls} />
          </Field>

          <Field label="Section">
            <select value={section} onChange={e => setSection(e.target.value)} className={inputCls}>
              <option value="objects">objects</option>
              <option value="art">art</option>
            </select>
          </Field>

          <Field label="Collection">
            <select
              value={newColl.trim() ? '__new__' : collection}
              onChange={e => {
                if (e.target.value === '__new__') return
                setCollection(e.target.value); setNewColl('')
              }}
              className={inputCls}
            >
              <option value="">Select…</option>
              {knownCollections.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__" disabled>── or type new below ──</option>
            </select>
            <input
              value={newColl}
              onChange={e => { setNewColl(e.target.value); if (e.target.value) setCollection('') }}
              placeholder="New collection name…"
              className={inputCls + ' mt-1.5 text-xs'}
            />
          </Field>

          <Field label="Movement / Style">
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
            <Field
              label="Tags"
              hint={`${tags.split(',').filter(t => t.trim()).length}/13 · comma-separated`}
            >
              <textarea value={tags} onChange={e => setTags(e.target.value)}
                rows={2} placeholder="snorlax shirt, pokemon gift, anime tee, …"
                className={`${inputCls} resize-none`} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Advanced — urgency + related */}
      <Collapsible label="⚡ Advanced (urgency, upsell)" defaultOpen={false}>
      <Card title="Advanced">
        <div className="space-y-4">
          <Field label="Urgency badge" hint="Shown near Add to Cart. Leave empty to hide.">
            <input value={urgency} onChange={e => setUrgency(e.target.value)}
              placeholder="Only 3 left in this colorway!" className={inputCls} />
          </Field>
          <Field label="Related products (upsell)" hint="Product IDs comma-separated. Shown as «Complete the look».">
            <input value={relatedProducts} onChange={e => setRelatedProducts(e.target.value)}
              placeholder="snorlax-tshirt, snorlax-hoodie" className={inputCls} />
            {relatedProducts.trim() && (
              <div className="flex gap-2 flex-wrap mt-2">
                {relatedProducts.split(',').map(s => s.trim()).filter(Boolean).map(rid => {
                  const found = allProducts.find(p => p.id === rid)
                  return (
                    <span key={rid} className={`text-xs px-2 py-0.5 border ${found ? 'border-green-700 text-green-400' : 'border-red-800 text-red-400'}`}>
                      {rid}{found ? '' : ' ✗'}
                    </span>
                  )
                })}
              </div>
            )}
          </Field>
        </div>
      </Card>
      </Collapsible>

      {/* SEO & Social Keywords */}
      <Collapsible label="🔍 SEO & Social" defaultOpen={false}>
      <Card title="SEO & Social (keyword research)">
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
      </Collapsible>

      {/* Video */}
      <Collapsible label="🎬 Video" defaultOpen={false}>
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
      </Collapsible>

      {/* Images */}
      <Collapsible
        label={`🖼 Images${existingImages.length > 0 ? ` (${existingImages.length} uploaded)` : ''}`}
        defaultOpen={existingImages.length > 0}
      >
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
      </Collapsible>

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

// ── Product status helper ─────────────────────────────────────────────────────

function getProductStatus(p) {
  const hasImage = (p.heroImages?.length > 0) || (p.images?.length > 0)
  const hasSeo   = !!(p.seoTitle?.trim() && p.seoDescription?.trim())
  if (!hasImage) return { code: 'no-image', label: 'No image', dot: 'bg-red-500',    text: 'text-red-400'     }
  if (!hasSeo)   return { code: 'no-seo',   label: 'No SEO',   dot: 'bg-yellow-500', text: 'text-yellow-400'  }
  return               { code: 'ok',        label: 'OK',        dot: 'bg-emerald-500',text: 'text-emerald-400' }
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, title, children, fullHeight = false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative bg-gray-950 border-t border-gray-700 ${fullHeight ? 'h-[92vh]' : 'max-h-[90vh]'} flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-white text-sm font-medium truncate pr-4">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none w-8 h-8 flex items-center justify-center flex-shrink-0">×</button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Product Admin Card ────────────────────────────────────────────────────────

function ProductAdminCard({ product: p, onGenerate, onGallery, onDelete, deleting }) {
  const navigate = useNavigate()
  const status   = getProductStatus(p)
  const thumb    = p.heroImages?.[0] || p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 active:bg-gray-800/40 cursor-pointer transition-colors"
      onClick={() => navigate(`/admin/product/${p.id}`)}
    >
      {/* Thumbnail */}
      <div className="w-11 h-11 flex-shrink-0 bg-gray-800 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover"
            onError={e => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-lg">
            {p.section === 'art' ? '🖼' : '👕'}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-white text-sm font-medium truncate leading-tight">{p.name}</p>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} title={status.label} />
        </div>
        <p className="text-gray-500 text-xs truncate">
          {p.section}{p.collection ? ` · ${p.collection}` : ''} · {fmt(p.price)}
        </p>
      </div>
      {/* Actions */}
      <div className="flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => onGallery(p)}
          className="w-9 h-10 flex items-center justify-center text-gray-500 hover:text-purple-400 hover:bg-purple-900/20 transition-colors text-sm"
          title="Asset Gallery">🖼</button>
        <button onClick={() => onGenerate(p)}
          className="w-9 h-10 flex items-center justify-center text-indigo-400 hover:bg-indigo-900/30 transition-colors text-base"
          title="Quick Generate">✦</button>
        {p.adminManaged && (
          <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) onDelete(p) }} disabled={deleting}
            className="w-9 h-10 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Delete">{deleting ? '…' : '🗑'}</button>
        )}
        <span className="text-gray-600 text-xl ml-0.5">›</span>
      </div>
    </div>
  )
}

// ── Product List Tab ──────────────────────────────────────────────────────────

function ProductsTab({ onEdit, onGenerate, onGallery }) {
  const navigate = useNavigate()
  const [deletingId,   setDeletingId]   = useState(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [error,        setError]        = useState('')
  const [hidden,       setHidden]       = useState([])
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [search,       setSearch]       = useState('')

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

  const filtered = visible.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search.toLowerCase())
  )

  return (
    <div>
      {error && (
        <div className="bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm mb-3">{error}</div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors min-w-0"
        />
        <button
          onClick={handleExportCSV}
          className="border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-2 text-xs transition-colors flex-shrink-0"
          title="Export CSV"
        >⬇</button>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white px-3 py-2 text-xs transition-colors flex-shrink-0"
          >
            {bulkDeleting ? '…' : `🗑 ${selectedIds.size}`}
          </button>
        )}
      </div>

      <p className="text-gray-600 text-xs mb-2 px-1">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </p>

      {/* Card list */}
      <div className="bg-gray-900 border border-gray-800 divide-y divide-gray-800/50">
        {filtered.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-10">No products found.</p>
        )}
        {filtered.map(p => (
          <ProductAdminCard
            key={p.id}
            product={p}
            onGenerate={onGenerate}
            onGallery={onGallery}
            onDelete={handleDelete}
            deleting={deletingId === p.id}
          />
        ))}
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

// ── Home Tab ──────────────────────────────────────────────────────────────────

function HomeTab({ onNavigate, onGenerate }) {
  const [reviews,       setReviews]       = useState([])
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [acting,        setActing]        = useState(null)
  const [error,         setError]         = useState('')

  const totalProducts = allProducts.length
  const noImage       = allProducts.filter(p => !(p.heroImages?.length > 0) && !(p.images?.length > 0)).length
  const noSeo         = allProducts.filter(p => {
    const hasImage = (p.heroImages?.length > 0) || (p.images?.length > 0)
    return hasImage && !(p.seoTitle?.trim() && p.seoDescription?.trim())
  }).length

  useEffect(() => {
    api('list-reviews', {})
      .then(d => { setReviews(d.reviews || []); setReviewsLoaded(true) })
      .catch(() => setReviewsLoaded(true))
  }, [])

  const pendingReviews = reviews.filter(r => r.status === 'pending')

  const moderate = async (reviewId, decision) => {
    setActing(reviewId + decision); setError('')
    try {
      await api('moderate-review', { reviewId, decision })
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: decision === 'approve' ? 'approved' : 'rejected' } : r))
    } catch (e) { setError(e.message) }
    finally { setActing(null) }
  }

  return (
    <div className="p-4 pb-6 space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Products', value: totalProducts, color: 'text-white', onClick: () => onNavigate('products') },
          { label: 'No SEO',   value: noSeo,  color: noSeo > 0  ? 'text-yellow-400' : 'text-emerald-400', onClick: () => onNavigate('products') },
          { label: 'No image', value: noImage, color: noImage > 0 ? 'text-red-400'    : 'text-emerald-400', onClick: () => onNavigate('products') },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="bg-gray-900 border border-gray-800 active:bg-gray-800 p-4 text-center transition-colors"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-0.5 tracking-wide uppercase font-mono">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('generate')}
          className="bg-indigo-900/40 border border-indigo-700/50 hover:bg-indigo-900/60 active:bg-indigo-900/80 text-indigo-300 p-4 text-left transition-colors"
        >
          <p className="text-lg mb-1">✦</p>
          <p className="text-sm font-medium">Quick Generate</p>
          <p className="text-indigo-400/70 text-xs mt-0.5">AI assets for any product</p>
        </button>
        <button
          onClick={() => onNavigate('add')}
          className="bg-gray-900 border border-gray-800 hover:bg-gray-800 active:bg-gray-700 text-gray-300 p-4 text-left transition-colors"
        >
          <p className="text-lg mb-1">＋</p>
          <p className="text-sm font-medium">Add Product</p>
          <p className="text-gray-500 text-xs mt-0.5">Create new listing</p>
        </button>
      </div>

      {/* Pending reviews */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Pending Reviews</h3>
          {pendingReviews.length > 0 && (
            <button onClick={() => onNavigate('reviews')} className="text-indigo-400 text-xs">See all →</button>
          )}
        </div>
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        {!reviewsLoaded && <p className="text-gray-600 text-sm py-4 text-center">Loading…</p>}
        {reviewsLoaded && pendingReviews.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 px-4 py-6 text-center">
            <p className="text-emerald-400 text-sm">✓ All reviews moderated</p>
          </div>
        )}
        {reviewsLoaded && pendingReviews.slice(0, 3).map(r => (
          <div key={r.id} className="bg-gray-900 border border-yellow-800/40 p-4 mb-2">
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{r.author}</p>
                <p className="text-gray-500 text-xs">{r.productId} · {'★'.repeat(r.rating)}</p>
                <p className="text-gray-300 text-sm mt-1 leading-relaxed line-clamp-2">{r.body}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => moderate(r.id, 'approve')}
                disabled={!!acting}
                className="flex-1 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white py-2.5 text-sm font-medium transition-colors"
              >{acting === r.id + 'approve' ? '…' : '✓ Approve'}</button>
              <button
                onClick={() => moderate(r.id, 'reject')}
                disabled={!!acting}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white py-2.5 text-sm font-medium transition-colors"
              >{acting === r.id + 'reject' ? '…' : '✗ Reject'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Product audit sneak peek */}
      {(noImage > 0 || noSeo > 0) && (
        <div>
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Product Audit</h3>
          <div className="bg-gray-900 border border-gray-800 divide-y divide-gray-800/60">
            {allProducts.filter(p => {
              const s = getProductStatus(p)
              return s.code !== 'ok'
            }).slice(0, 5).map(p => {
              const s = getProductStatus(p)
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <p className="text-white text-sm flex-1 truncate">{p.name}</p>
                  <span className={`text-xs ${s.text}`}>{s.label}</span>
                  <button
                    onClick={() => onGenerate(p)}
                    className="text-indigo-400 text-xs ml-2 hover:text-indigo-300"
                  >✦</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quick Generate Sheet ──────────────────────────────────────────────────────

function QuickGenerateSheet({ product, open, onClose }) {
  const [platforms,    setPlatforms]    = useState({ instagram: true, tiktok: true, pinterest: false, facebook: false })
  const [autoPublish,  setAutoPublish]  = useState(false)
  const [dryRun,       setDryRun]       = useState(true)
  const [running,      setRunning]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState('')

  // Reset when product changes
  useEffect(() => { setResult(null); setError('') }, [product])

  const selectedPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k)

  const handleLaunch = async () => {
    if (!product || selectedPlatforms.length === 0) return
    setRunning(true); setResult(null); setError('')
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey:      ADMIN_PASSWORD,
          task:        'generate-social',
          productId:   product.id,
          productName: product.name,
          productType: product.section,
          platforms:   selectedPlatforms,
          autoPublish,
          dryRun,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Agent failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  if (!product) return null

  return (
    <BottomSheet open={open} onClose={onClose} title={`✦ Generate — ${product.name}`}>
      <div className="p-4 space-y-5">
        {/* Platforms */}
        <div>
          <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-3">Platforms</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'instagram', label: 'Instagram', icon: '📸' },
              { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
              { id: 'pinterest', label: 'Pinterest',  icon: '📌' },
              { id: 'facebook',  label: 'Facebook',   icon: '👤' },
            ].map(pl => (
              <button
                key={pl.id}
                onClick={() => setPlatforms(prev => ({ ...prev, [pl.id]: !prev[pl.id] }))}
                className={`flex items-center gap-2 px-4 py-3 border text-sm transition-colors ${
                  platforms[pl.id]
                    ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200'
                    : 'bg-gray-900 border-gray-700 text-gray-500'
                }`}
              >
                <span>{pl.icon}</span>
                <span className="font-medium">{pl.label}</span>
                {platforms[pl.id] && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">Options</p>
          {[
            { label: 'Dry run (preview only)', sub: 'Generate copy without publishing', key: 'dryRun', val: dryRun, set: setDryRun },
            { label: 'Auto-publish', sub: 'Send directly to connected platforms', key: 'autoPublish', val: autoPublish, set: setAutoPublish },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => opt.set(v => !v)}
              className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 px-4 py-3 text-left transition-colors"
            >
              <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${opt.val ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'}`}>
                {opt.val && <span className="text-white text-xs leading-none">✓</span>}
              </div>
              <div>
                <p className="text-white text-sm">{opt.label}</p>
                <p className="text-gray-500 text-xs">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Result / Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 px-4 py-3 text-red-400 text-sm">{error}</div>
        )}
        {result && (
          <div className="bg-emerald-900/20 border border-emerald-800 px-4 py-3 text-emerald-400 text-sm">
            ✓ Agent launched successfully
            {result.jobId && <span className="block text-emerald-600 text-xs mt-1">Job: {result.jobId}</span>}
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={running || selectedPlatforms.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-4 text-sm font-semibold tracking-wide transition-colors"
        >
          {running ? '⟳ Generating…' : `✦ Launch Agent (${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Generate Tab ──────────────────────────────────────────────────────────────

function GenerateTab({ onGenerate, onGallery }) {
  const [search, setSearch] = useState('')
  const filtered = allProducts.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div>
      <div className="px-4 pt-4 pb-3">
        <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-3">Select a product to generate AI assets</p>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <div className="divide-y divide-gray-800/50">
        {filtered.map(p => {
          const status = getProductStatus(p)
          const thumb  = p.heroImages?.[0] || p.images?.[0]?.url || (typeof p.images?.[0] === 'string' ? p.images[0] : null)
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-800/40 cursor-pointer transition-colors">
              <div className="w-10 h-10 flex-shrink-0 bg-gray-800 overflow-hidden">
                {thumb
                  ? <img src={thumb} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <div className="w-full h-full flex items-center justify-center text-gray-600 text-base">{p.section === 'art' ? '🖼' : '👕'}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  <p className="text-gray-500 text-xs truncate">{p.section} · {fmt(p.price)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onGallery && (
                  <button
                    onClick={() => onGallery(p)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2.5 text-sm transition-colors"
                    title="Asset Gallery"
                  >🖼</button>
                )}
                <button
                  onClick={() => onGenerate(p)}
                  className="bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
                >✦ Go</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Batch Agent Tab ───────────────────────────────────────────────────────────

const BATCH_PLATFORMS = ['instagram', 'tiktok', 'pinterest', 'facebook']

function BatchAgentTab() {
  // Filters
  const collections  = [...new Set(allProducts.map(p => p.collection).filter(Boolean))]
  const [collFilter, setCollFilter] = useState('all')
  const [selected,   setSelected]  = useState(new Set())
  const [platforms,  setPlatforms] = useState({ instagram: true, tiktok: true, pinterest: false, facebook: false })
  const [autoPublish, setAutoPublish] = useState(false)
  const [dryRun,      setDryRun]      = useState(true)

  // Batch run state
  const [running,   setRunning]   = useState(false)
  const [progress,  setProgress]  = useState(null) // { current, total, productName }
  const [summary,   setSummary]   = useState(null) // final { processed, assets, queued, failed }
  const [error,     setError]     = useState('')

  const visible = allProducts.filter(p =>
    collFilter === 'all' || p.collection === collFilter
  )

  const allSelected = visible.length > 0 && visible.every(p => selected.has(p.id))
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(visible.map(p => p.id)))
  const toggleOne   = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const selectedPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k)
  const targets = visible.filter(p => selected.has(p.id))

  const handleLaunch = async () => {
    if (!targets.length || !selectedPlatforms.length) return
    setRunning(true); setSummary(null); setError('')
    let totalAssets = 0, totalQueued = 0, failed = 0

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      setProgress({ current: i + 1, total: targets.length, productName: p.name })
      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey:      ADMIN_PASSWORD,
            task:        'generate_social_content',
            productId:   p.id,
            productName: p.name,
            productType: p.section,
            collection:  p.collection,
            platforms:   selectedPlatforms,
            autoPublish,
            dryRun,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) { failed++; continue }

        // Save each asset to Gallery
        for (const asset of (data.assets || [])) {
          if (!asset.imageUrl && !asset.videoUrl) continue
          const assetUrl = asset.imageUrl || asset.videoUrl
          const platform = asset.platform || selectedPlatforms[0]
          const copy     = data.copy?.[platform] || {}
          try {
            await api('save-asset', {
              assetUrl, productId: p.id,
              type:     asset.videoUrl ? 'video' : 'image',
              platform,
              caption:  copy.caption  || '',
              hashtags: copy.hashtags || '',
            })
            totalAssets++
          } catch {}
        }

        // Add to Content Queue (one item per platform with generated copy)
        const scheduledBase = new Date()
        for (let pi = 0; pi < selectedPlatforms.length; pi++) {
          const pl   = selectedPlatforms[pi]
          const copy = data.copy?.[pl] || {}
          const imgAsset = (data.assets || []).find(a => (a.platform === pl || !a.platform) && a.imageUrl)
          try {
            const scheduled = new Date(scheduledBase)
            scheduled.setDate(scheduled.getDate() + i + pi) // spread by day
            await api('save-queue-item', {
              item: {
                platform:    pl,
                productId:   p.id,
                imageUrl:    imgAsset?.imageUrl || '',
                caption:     copy.caption  || '',
                hashtags:    copy.hashtags || '',
                scheduledAt: scheduled.toISOString(),
              },
            })
            totalQueued++
          } catch {}
        }

        totalAssets += (data.assets || []).length
      } catch { failed++ }
    }

    setRunning(false)
    setProgress(null)
    setSummary({ processed: targets.length - failed, assets: totalAssets, queued: totalQueued, failed })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Collection filter */}
      <div>
        <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Filter by Collection</p>
        <div className="flex gap-2 flex-wrap">
          {['all', ...collections].map(c => (
            <button key={c} onClick={() => { setCollFilter(c); setSelected(new Set()) }}
              className={`px-3 py-1.5 text-xs rounded transition-colors capitalize ${collFilter === c ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Product list with checkboxes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">Select Products</p>
          <button onClick={toggleAll} className="text-indigo-400 text-xs hover:text-indigo-300">
            {allSelected ? 'Deselect all' : `Select all (${visible.length})`}
          </button>
        </div>
        <div className="bg-gray-900 border border-gray-800 divide-y divide-gray-800/50 max-h-64 overflow-y-auto">
          {visible.map(p => {
            const status = getProductStatus(p)
            return (
              <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-800/40">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                  className="accent-indigo-500 w-4 h-4 flex-shrink-0" />
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                <span className="text-white text-sm flex-1 truncate">{p.name}</span>
                <span className="text-gray-600 text-xs flex-shrink-0">{p.collection}</span>
              </label>
            )
          })}
        </div>
        {selected.size > 0 && (
          <p className="text-indigo-300 text-xs mt-1.5">{selected.size} product{selected.size !== 1 ? 's' : ''} selected</p>
        )}
      </div>

      {/* Platforms */}
      <div>
        <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Platforms</p>
        <div className="grid grid-cols-2 gap-2">
          {BATCH_PLATFORMS.map(pl => (
            <button key={pl} onClick={() => setPlatforms(prev => ({ ...prev, [pl]: !prev[pl] }))}
              className={`flex items-center gap-2 px-3 py-2.5 border text-sm transition-colors capitalize ${platforms[pl] ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
            >
              <span>{pl === 'instagram' ? '📸' : pl === 'tiktok' ? '🎵' : pl === 'pinterest' ? '📌' : '👤'}</span>
              {pl}
              {platforms[pl] && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex gap-3">
        {[
          { label: 'Dry Run', key: 'dryRun', val: dryRun, set: setDryRun },
          { label: 'Auto-Publish', key: 'ap', val: autoPublish, set: setAutoPublish },
        ].map(opt => (
          <button key={opt.key} onClick={() => opt.set(v => !v)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 border text-sm transition-colors ${opt.val ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
          >
            <span className={`w-4 h-4 border-2 flex items-center justify-center text-xs ${opt.val ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-600'}`}>{opt.val ? '✓' : ''}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Progress */}
      {running && progress && (
        <div className="bg-indigo-900/20 border border-indigo-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-indigo-300 text-sm font-medium">Running batch…</p>
            <p className="text-indigo-400 text-xs">{progress.current}/{progress.total}</p>
          </div>
          <div className="w-full bg-gray-800 h-1.5 rounded-full">
            <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <p className="text-indigo-400/70 text-xs mt-1.5 truncate">⟳ {progress.productName}</p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className={`border px-4 py-4 ${summary.failed > 0 ? 'bg-yellow-900/20 border-yellow-800' : 'bg-emerald-900/20 border-emerald-800'}`}>
          <p className={`text-sm font-semibold mb-3 ${summary.failed > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {summary.failed > 0 ? `⚠ Batch complete with ${summary.failed} error${summary.failed !== 1 ? 's' : ''}` : '✓ Batch complete!'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Processed', value: summary.processed },
              { label: 'Assets saved', value: summary.assets },
              { label: 'In Queue', value: summary.queued },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-white text-xl font-bold">{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>}

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={running || targets.length === 0 || selectedPlatforms.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-4 text-sm font-semibold tracking-wide transition-colors"
      >
        {running
          ? `⟳ Processing ${progress?.current || 0}/${targets.length}…`
          : `⚡ Launch Batch — ${targets.length} product${targets.length !== 1 ? 's' : ''} × ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''}`
        }
      </button>
    </div>
  )
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────

const fmtRevenue = cents => `€${(cents / 100).toFixed(2)}`
const fmtK       = cents => cents >= 100000 ? `€${(cents / 100000).toFixed(1)}k` : fmtRevenue(cents)

function RevenueBar({ value, max, color = 'bg-indigo-500' }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden">
      <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function RevenueTab() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await api('revenue-stats', {})
      setStats(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <p className="text-gray-600 text-sm py-12 text-center">Loading revenue data…</p>
  if (error)   return (
    <div className="p-4">
      <div className="bg-red-900/20 border border-red-800 px-4 py-3 text-red-400 text-sm">{error}</div>
      <button onClick={load} className="mt-3 text-indigo-400 text-sm">↻ Retry</button>
    </div>
  )
  if (!stats)  return null

  const maxMonthRev  = Math.max(...stats.monthlyTrend.map(m => m.revenue), 1)
  const maxProdRev   = Math.max(...stats.topProducts.map(p => p.revenue), 1)
  const maxCollRev   = Math.max(...stats.topCollections.map(c => c.revenue), 1)

  return (
    <div className="p-4 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Revenue',   value: fmtK(stats.totalRevenue), sub: 'lifetime' },
          { label: 'Orders',    value: stats.totalOrders,         sub: 'total' },
          { label: 'Avg Order', value: fmtRevenue(stats.aov),     sub: 'AOV' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 p-4 text-center">
            <p className="text-white text-xl font-bold">{s.value}</p>
            <p className="text-gray-500 text-xs mt-0.5 uppercase tracking-wide font-mono">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly trend */}
      <div>
        <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-3">Monthly Revenue (last 6 months)</h3>
        {stats.monthlyTrend.every(m => m.revenue === 0) ? (
          <p className="text-gray-600 text-sm text-center py-4">No data yet</p>
        ) : (
          <div className="flex items-end gap-2 h-24">
            {stats.monthlyTrend.map(m => {
              const pct = maxMonthRev > 0 ? Math.max(4, Math.round((m.revenue / maxMonthRev) * 100)) : 4
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-gray-600 text-[9px] font-mono">{m.revenue > 0 ? fmtK(m.revenue) : ''}</span>
                  <div className="w-full bg-indigo-600/80 rounded-t transition-all duration-700" style={{ height: `${pct}%`, minHeight: m.revenue > 0 ? '4px' : '0' }} />
                  <span className="text-gray-600 text-[9px] font-mono">{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top products */}
      {stats.topProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Top Products</h3>
            <button onClick={load} className="text-gray-600 hover:text-gray-400 text-xs">↻</button>
          </div>
          <div className="space-y-3">
            {stats.topProducts.map((p, i) => (
              <div key={p.productId}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-600 text-xs w-4 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-white text-sm flex-1 truncate">{p.name || p.productId}</span>
                  <span className="text-white text-sm font-semibold flex-shrink-0">{fmtRevenue(p.revenue)}</span>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <RevenueBar value={p.revenue} max={maxProdRev} />
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="text-gray-500">{p.orders} orders</span>
                    {p.marginPct !== null && (
                      <span className={`font-mono ${p.marginPct >= 50 ? 'text-emerald-400' : p.marginPct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {p.marginPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by collection */}
      {stats.topCollections.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-3">By Collection</h3>
          <div className="space-y-3">
            {stats.topCollections.map(c => (
              <div key={c.collection}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm flex-1 capitalize truncate">{c.collection || 'General'}</span>
                  <span className="text-white text-sm font-semibold">{fmtRevenue(c.revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RevenueBar value={c.revenue} max={maxCollRev} color="bg-purple-500" />
                  <span className="text-gray-500 text-xs flex-shrink-0">{c.orders} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SEO Audit Tab ─────────────────────────────────────────────────────────────

function SeoAuditTab() {
  const [expandedId, setExpandedId]   = useState(null)
  const [generating,  setGenerating]  = useState(null)   // productId
  const [suggestions, setSuggestions] = useState({})     // { [productId]: seo }
  const [saving,      setSaving]      = useState(null)   // productId
  const [saved,       setSaved]       = useState({})     // { [productId]: bool }
  const [error,       setError]       = useState('')

  // Editable drafts per product
  const [drafts, setDrafts] = useState({})

  const setDraft = (productId, key, value) =>
    setDrafts(prev => ({ ...prev, [productId]: { ...(prev[productId] || {}), [key]: value } }))

  const getDraft = (productId, key, fallback = '') =>
    drafts[productId]?.[key] ?? suggestions[productId]?.[key] ?? fallback

  const handleGenerate = async (p) => {
    setGenerating(p.id); setError('')
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-seo', password: ADMIN_PASSWORD,
          productId: p.id, productName: p.name,
          productType: p.section, collection: p.collection,
          description: p.seoDescription, tags: p.tags,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SEO generation failed')
      setSuggestions(prev => ({ ...prev, [p.id]: data.seo }))
      setDrafts(prev => ({ ...prev, [p.id]: {} }))
      setExpandedId(p.id)
    } catch (e) { setError(e.message) }
    finally { setGenerating(null) }
  }

  const handleApply = async (p) => {
    setSaving(p.id); setError('')
    const seo = {
      etsyTitle:       getDraft(p.id, 'etsyTitle'),
      etsyDescription: getDraft(p.id, 'etsyDescription'),
      etsyTags:        getDraft(p.id, 'etsyTags'),
      seoTitle:        getDraft(p.id, 'seoTitle'),
      seoDescription:  getDraft(p.id, 'seoDescription'),
      altText:         getDraft(p.id, 'altText'),
    }
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-product', password: ADMIN_PASSWORD,
          product: { ...p, ...seo, tags: Array.isArray(seo.etsyTags) ? seo.etsyTags : (seo.etsyTags || '').split(',').map(t => t.trim()).filter(Boolean) },
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setSaved(prev => ({ ...prev, [p.id]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [p.id]: false })), 3000)
    } catch (e) { setError(e.message) }
    finally { setSaving(null) }
  }

  const scoreColor = (val, max, warn, ok) => {
    if (!val) return 'text-red-400'
    const len = typeof val === 'string' ? val.length : (Array.isArray(val) ? val.length : 0)
    if (len >= ok)   return 'text-emerald-400'
    if (len >= warn) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div>
      {error && <div className="mx-4 mb-3 bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>}
      <p className="px-4 py-3 text-gray-500 text-xs">
        {allProducts.length} products · tap ✦ to generate Etsy SEO with AI
      </p>

      <div className="divide-y divide-gray-800/50">
        {allProducts.map(p => {
          const status = getProductStatus(p)
          const seoOk  = !!(p.seoTitle?.trim() && p.seoDescription?.trim())
          const hasSug = !!suggestions[p.id]
          const isOpen = expandedId === p.id

          return (
            <div key={p.id} className="bg-gray-950">
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs">
                    <span className={seoOk ? 'text-emerald-400' : 'text-red-400'}>
                      {seoOk ? '✓ SEO' : '✗ SEO'}
                    </span>
                    <span className={p.etsyTitle ? 'text-emerald-400' : 'text-gray-600'}>
                      {p.etsyTitle ? '✓ Etsy' : '✗ Etsy'}
                    </span>
                    {p.tags?.length > 0 && <span className="text-gray-500">{p.tags.length} tags</span>}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleGenerate(p) }}
                  disabled={generating === p.id}
                  className="flex-shrink-0 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  {generating === p.id ? '⟳' : '✦ Gen'}
                </button>
                <span className="text-gray-600 text-lg flex-shrink-0">{isOpen ? '▾' : '›'}</span>
              </div>

              {/* Expanded SEO editor */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-800/50 bg-gray-900/30">
                  {!hasSug && (
                    <p className="text-gray-500 text-xs py-2 text-center">
                      Tap ✦ Gen to generate AI suggestions, then edit and apply.
                    </p>
                  )}
                  {hasSug && (
                    <>
                      {[
                        { key: 'etsyTitle',       label: 'Etsy Title',       max: 140, hint: 'chars · max 140' },
                        { key: 'etsyDescription', label: 'Etsy Description', max: 400, hint: 'chars · 200-400 ideal', textarea: true },
                        { key: 'seoTitle',        label: 'SEO Title',        max: 60,  hint: 'chars · max 60' },
                        { key: 'seoDescription',  label: 'SEO Description',  max: 160, hint: 'chars · max 160', textarea: true },
                        { key: 'altText',         label: 'Alt Text',         max: 125, hint: 'chars · max 125' },
                      ].map(field => {
                        const val = getDraft(p.id, field.key)
                        const len = val.length
                        const over = len > field.max
                        return (
                          <div key={field.key}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-gray-500 text-xs">{field.label}</label>
                              <span className={`text-xs ${over ? 'text-red-400' : len > field.max * 0.85 ? 'text-yellow-400' : 'text-gray-600'}`}>
                                {len}/{field.max}
                              </span>
                            </div>
                            {field.textarea ? (
                              <textarea
                                value={val}
                                onChange={e => setDraft(p.id, field.key, e.target.value)}
                                rows={3}
                                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                              />
                            ) : (
                              <input
                                value={val}
                                onChange={e => setDraft(p.id, field.key, e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                              />
                            )}
                          </div>
                        )
                      })}

                      {/* Etsy Tags */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-gray-500 text-xs">Etsy Tags</label>
                          <span className="text-gray-600 text-xs">
                            {(Array.isArray(getDraft(p.id, 'etsyTags'))
                              ? getDraft(p.id, 'etsyTags')
                              : (getDraft(p.id, 'etsyTags') || '').split(',').filter(Boolean)
                            ).length}/13
                          </span>
                        </div>
                        <input
                          value={Array.isArray(getDraft(p.id, 'etsyTags')) ? getDraft(p.id, 'etsyTags').join(', ') : getDraft(p.id, 'etsyTags')}
                          onChange={e => setDraft(p.id, 'etsyTags', e.target.value)}
                          placeholder="tag1, tag2, tag3…"
                          className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-gray-600 text-xs mt-1">Comma-separated · max 20 chars each · max 13</p>
                      </div>

                      <button
                        onClick={() => handleApply(p)}
                        disabled={saving === p.id}
                        className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white py-3 text-sm font-semibold transition-colors"
                      >
                        {saving === p.id ? 'Saving…' : saved[p.id] ? '✓ Saved!' : '✓ Apply & Save to GitHub'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Content Queue Tab ─────────────────────────────────────────────────────────

const QUEUE_PLATFORMS = ['instagram', 'tiktok', 'pinterest', 'facebook']

function ContentQueueTab() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [filter,     setFilter]     = useState('pending') // 'all'|'pending'|'published'|'failed'
  const [addOpen,    setAddOpen]    = useState(false)
  const [publishing, setPublishing] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await api('list-queue', {})
      setItems((d.items || []).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async id => {
    if (!confirm('Delete this queue item?')) return
    try { await api('delete-queue-item', { itemId: id }); setItems(prev => prev.filter(i => i.id !== id)) }
    catch (e) { setError(e.message) }
  }

  const handlePublishNow = async id => {
    setPublishing(id); setError('')
    try {
      await api('publish-queue-item', { itemId: id })
      await load()
    } catch (e) { setError(e.message) }
    finally { setPublishing(null) }
  }

  const visible = items.filter(i => filter === 'all' || i.status === filter)
  const pendingCount = items.filter(i => i.status === 'pending').length

  const statusBadge = s =>
    s === 'published' ? 'bg-emerald-900/60 text-emerald-400'
    : s === 'failed'  ? 'bg-red-900/60 text-red-400'
    : 'bg-yellow-900/60 text-yellow-400'

  const platformIcon = p =>
    p === 'instagram' ? '📸' : p === 'tiktok' ? '🎵' : p === 'pinterest' ? '📌' : '👤'

  return (
    <div>
      {/* Add Item Sheet */}
      <QueueItemForm open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load() }} />

      {error && <div className="mx-4 mb-3 bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>}

      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {[['pending', pendingCount], ['published', null], ['failed', null], ['all', null]].map(([f, cnt]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${filter === f ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {cnt > 0 && <span className="ml-1 bg-yellow-500 text-black text-[9px] w-4 h-4 rounded-full inline-flex items-center justify-center font-bold">{cnt}</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex-shrink-0 bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
        >+ Schedule</button>
        <button onClick={load} className="flex-shrink-0 text-gray-500 hover:text-gray-300 text-sm px-2 py-1.5 border border-gray-700">↻</button>
      </div>

      {loading && <p className="text-gray-600 text-sm py-8 text-center">Loading…</p>}

      {!loading && visible.length === 0 && (
        <p className="text-gray-600 text-sm py-8 text-center">
          {filter === 'pending' ? 'No scheduled posts. Tap + Schedule to add one.' : `No ${filter} posts.`}
        </p>
      )}

      <div className="divide-y divide-gray-800/50">
        {visible.map(item => (
          <div key={item.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0 mt-0.5">{platformIcon(item.platform)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-xs font-semibold capitalize">{item.platform}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge(item.status)}`}>{item.status}</span>
                </div>
                {item.productId && <p className="text-gray-500 text-xs mb-1">📦 {item.productId}</p>}
                {item.caption && <p className="text-gray-300 text-sm leading-relaxed line-clamp-2 mb-1">{item.caption}</p>}
                <p className="text-gray-500 text-xs">
                  🕐 {new Date(item.scheduledAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
                {item.error && <p className="text-red-400 text-xs mt-1">⚠ {item.error}</p>}
              </div>
              {item.imageUrl && (
                <img src={item.imageUrl} alt="" className="w-12 h-12 object-cover flex-shrink-0 bg-gray-800" onError={e => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>

            {/* Actions */}
            {item.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handlePublishNow(item.id)}
                  disabled={publishing === item.id}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white py-2.5 text-xs font-semibold transition-colors"
                >
                  {publishing === item.id ? '⟳ Publishing…' : '▶ Publish now'}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-4 py-2.5 text-xs transition-colors"
                >🗑</button>
              </div>
            )}
            {item.status !== 'pending' && (
              <button onClick={() => handleDelete(item.id)} className="mt-2 text-gray-600 hover:text-red-400 text-xs transition-colors">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Queue Item Form ───────────────────────────────────────────────────────────

function QueueItemForm({ open, onClose, onSaved }) {
  const [platform,    setPlatform]    = useState('instagram')
  const [productId,   setProductId]   = useState('')
  const [imageUrl,    setImageUrl]    = useState('')
  const [caption,     setCaption]     = useState('')
  const [hashtags,    setHashtags]    = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const handleSave = async () => {
    if (!scheduledAt) return setError('Select a date/time')
    setSaving(true); setError('')
    try {
      await api('save-queue-item', {
        item: { platform, productId, imageUrl, caption, hashtags, scheduledAt: new Date(scheduledAt).toISOString() },
      })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Schedule a Post" fullHeight>
      <div className="p-4 space-y-4">
        {error && <div className="bg-red-900/20 border border-red-800 px-3 py-2 text-red-400 text-sm">{error}</div>}

        {/* Platform */}
        <div>
          <label className="block text-gray-500 text-xs mb-2">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            {QUEUE_PLATFORMS.map(pl => (
              <button key={pl} onClick={() => setPlatform(pl)}
                className={`py-2.5 text-sm font-medium capitalize transition-colors ${platform === pl ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >{pl}</button>
            ))}
          </div>
        </div>

        {/* Product */}
        <div>
          <label className="block text-gray-500 text-xs mb-1">Product (optional)</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
            <option value="">— None —</option>
            {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-gray-500 text-xs mb-1">Image URL</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        {/* Caption */}
        <div>
          <label className="block text-gray-500 text-xs mb-1">Caption</label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)}
            rows={3} placeholder="Write your caption…"
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-gray-500 text-xs mb-1">Hashtags</label>
          <input value={hashtags} onChange={e => setHashtags(e.target.value)}
            placeholder="#art #print #jayl"
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        {/* Schedule date/time */}
        <div>
          <label className="block text-gray-500 text-xs mb-1">Schedule date & time</label>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          <p className="text-gray-600 text-xs mt-1">Cron runs daily at 08:00 UTC — or use ▶ Publish now for immediate.</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-4 text-sm font-semibold transition-colors"
        >{saving ? 'Saving…' : '✓ Add to Queue'}</button>
      </div>
    </BottomSheet>
  )
}

// ── Asset Gallery Sheet ───────────────────────────────────────────────────────

function AssetGallerySheet({ product, open, onClose }) {
  const [assets,   setAssets]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [copied,   setCopied]   = useState(null)
  const [error,    setError]    = useState('')

  const load = async () => {
    if (!product) return
    setLoading(true); setError('')
    try {
      const d = await api('list-assets', { productId: product.id })
      setAssets(d.assets || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open && product) load() }, [open, product?.id])

  const handleDelete = async id => {
    if (!confirm('Delete this asset permanently?')) return
    setDeleting(id); setError('')
    try {
      await api('delete-asset', { assetId: id })
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch (e) { setError(e.message) }
    finally { setDeleting(null) }
  }

  const handleCopy = async url => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* fallback */ }
  }

  const handleSetMainImage = async asset => {
    if (!confirm('Set this as the main product image?')) return
    try {
      await api('save-product', {
        product: { ...product, heroImages: [asset.blobUrl, ...(product.heroImages || []).filter(u => u !== asset.blobUrl)] }
      })
      alert('✓ Set as main image — deploy in ~2 min')
    } catch (e) { setError(e.message) }
  }

  const handlePublish = async asset => {
    const platform = prompt('Platform to publish to (instagram/tiktok/pinterest/facebook):')
    if (!platform || !['instagram', 'tiktok', 'pinterest', 'facebook'].includes(platform)) return
    try {
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD, platform,
          imageUrl: asset.type !== 'video' ? asset.blobUrl : undefined,
          videoUrl: asset.type === 'video' ? asset.blobUrl : undefined,
          caption: asset.caption, hashtags: asset.hashtags,
        }),
      })
      const data = await res.json()
      if (data.ok) alert(`✓ Published to ${platform}!`)
      else alert(`✗ ${data.message || data.error}`)
    } catch (e) { setError(e.message) }
  }

  if (!product) return null

  return (
    <BottomSheet open={open} onClose={onClose} title={`Gallery — ${product.name}`} fullHeight>
      {error && <div className="mx-4 mt-3 bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>}

      {loading && <p className="text-gray-600 text-sm py-8 text-center">Loading assets…</p>}

      {!loading && assets.length === 0 && (
        <div className="text-center py-12 px-6">
          <p className="text-gray-500 text-sm mb-2">No saved assets yet</p>
          <p className="text-gray-600 text-xs">Generate assets for this product and tap "Save to Gallery"</p>
        </div>
      )}

      {/* Asset grid */}
      {assets.length > 0 && (
        <div className="p-3 space-y-3">
          {assets.map(asset => (
            <div key={asset.id} className="bg-gray-900 border border-gray-800 overflow-hidden">
              {/* Media */}
              {asset.type === 'video' ? (
                <video src={asset.blobUrl} controls className="w-full aspect-video bg-black" />
              ) : (
                <img src={asset.blobUrl} alt="" className="w-full aspect-square object-cover bg-gray-800"
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              )}

              {/* Meta */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  {asset.platform && (
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full capitalize">{asset.platform}</span>
                  )}
                  <span className="text-gray-600 text-xs">{new Date(asset.createdAt).toLocaleDateString('it-IT')}</span>
                </div>
                {asset.caption && <p className="text-gray-400 text-xs line-clamp-2 mb-3">{asset.caption}</p>}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={asset.blobUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 text-xs font-medium transition-colors"
                  >⬇ Download</a>
                  <button
                    onClick={() => handleCopy(asset.blobUrl)}
                    className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 text-xs font-medium transition-colors"
                  >{copied === asset.blobUrl ? '✓ Copied!' : '📋 Copy URL'}</button>
                  {asset.type !== 'video' && (
                    <button
                      onClick={() => handleSetMainImage(asset)}
                      className="flex items-center justify-center gap-1.5 bg-indigo-900/50 hover:bg-indigo-900/80 text-indigo-300 py-2 text-xs font-medium transition-colors"
                    >🖼 Set Main</button>
                  )}
                  <button
                    onClick={() => handlePublish(asset)}
                    className="flex items-center justify-center gap-1.5 bg-emerald-900/50 hover:bg-emerald-900/80 text-emerald-300 py-2 text-xs font-medium transition-colors"
                  >▶ Publish</button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    disabled={deleting === asset.id}
                    className="col-span-2 flex items-center justify-center gap-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 py-2 text-xs font-medium transition-colors disabled:opacity-40"
                  >{deleting === asset.id ? '…' : '🗑 Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ active, onNavigate, pendingCount }) {
  const items = [
    { id: 'home',     icon: '⌂',  label: 'Home'     },
    { id: 'products', icon: '▦',  label: 'Products'  },
    { id: 'generate', icon: '✦',  label: 'Generate'  },
    { id: 'reviews',  icon: '★',  label: 'Reviews', badge: pendingCount },
    { id: 'more',     icon: '⋯',  label: 'More'     },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950 border-t border-gray-800 flex items-stretch">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${
            active === item.id ? 'text-indigo-400' : 'text-gray-600 active:text-gray-300'
          }`}
        >
          {item.id === 'generate' ? (
            <span className={`text-xl leading-none transition-colors ${active === 'generate' ? 'text-indigo-400' : 'text-gray-500'}`}>{item.icon}</span>
          ) : (
            <span className="text-base leading-none">{item.icon}</span>
          )}
          <span className="text-[10px] tracking-wide font-mono">{item.label}</span>
          {item.badge > 0 && (
            <span className="absolute top-1.5 right-1/4 bg-yellow-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

// ── More Drawer ───────────────────────────────────────────────────────────────

function MoreDrawer({ open, onClose, onNavigate, onLogout }) {
  const nav = (id) => { onClose(); onNavigate(id) }
  const items = [
    { id: 'revenue',     icon: '📊', label: 'Revenue',       sub: 'Sales analytics & margins' },
    { id: 'batch',       icon: '⚡', label: 'Batch Agent',   sub: 'Generate assets for a collection' },
    { id: 'seo-audit',   icon: '🔍', label: 'SEO Audit',     sub: 'AI-powered Etsy SEO fixes' },
    { id: 'queue',       icon: '📅', label: 'Content Queue',  sub: 'Scheduled social posts' },
    { id: 'add',         icon: '＋', label: 'Add Product',    sub: 'Create a new listing' },
    { id: 'collections', icon: '▤',  label: 'Collections',   sub: 'Manage product groups' },
    { id: 'personas',    icon: '🎭', label: 'Personas',      sub: 'Influencer personas' },
    { id: 'orders',      icon: '📦', label: 'Orders',        sub: 'Customer order history' },
    { id: 'settings',    icon: '⚙',  label: 'Settings',      sub: 'Social links & subscribers' },
  ]
  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <div className="divide-y divide-gray-800/60">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => nav(item.id)}
            className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-gray-800/50 transition-colors"
          >
            <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-white text-sm font-medium">{item.label}</p>
              <p className="text-gray-500 text-xs">{item.sub}</p>
            </div>
            <span className="ml-auto text-gray-700 text-lg">›</span>
          </button>
        ))}
        <button
          onClick={() => { onClose(); onLogout() }}
          className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-gray-800/50 transition-colors"
        >
          <span className="text-xl w-7 text-center flex-shrink-0">⏻</span>
          <div>
            <p className="text-red-400 text-sm font-medium">Logout</p>
            <p className="text-gray-500 text-xs">End admin session</p>
          </div>
        </button>
      </div>
    </BottomSheet>
  )
}

export default function AdminPage() {
  const [authed, setAuthed]             = useState(() => sessionStorage.getItem('adminAuth') === '1')
  const [tab,    setTab]                = useState('home')
  const [editingProduct, setEditingProduct]   = useState(null)
  const [generateProduct, setGenerateProduct] = useState(null)
  const [galleryProduct,  setGalleryProduct]  = useState(null)
  const [moreOpen, setMoreOpen]         = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Load pending review count on mount
  useEffect(() => {
    if (!authed) return
    api('list-reviews', {})
      .then(d => setPendingCount((d.reviews || []).filter(r => r.status === 'pending').length))
      .catch(() => {})
  }, [authed])

  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true) }} />

  const handleEdit   = product => setEditingProduct(product)
  const handleSaved  = ()      => setEditingProduct(null)
  const handleCancel = ()      => setEditingProduct(null)
  const logout       = ()      => { sessionStorage.removeItem('adminAuth'); setAuthed(false) }

  const handleGenerate = product => setGenerateProduct(product)
  const handleGallery  = product => setGalleryProduct(product)

  const navigate = id => {
    if (id === 'more') { setMoreOpen(true); return }
    setTab(id)
  }

  // Secondary tabs shown via MoreDrawer
  const isSecondaryTab = ['add', 'collections', 'personas', 'orders', 'settings'].includes(tab)

  return (
    <>
      {/* ── Edit modal ── */}
      <Modal open={!!editingProduct} onClose={handleCancel}>
        {editingProduct && (
          <AddProductTab
            editingProduct={editingProduct}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        )}
      </Modal>

      {/* ── Quick Generate sheet ── */}
      <QuickGenerateSheet
        product={generateProduct}
        open={!!generateProduct}
        onClose={() => setGenerateProduct(null)}
      />

      {/* ── Asset Gallery sheet ── */}
      <AssetGallerySheet
        product={galleryProduct}
        open={!!galleryProduct}
        onClose={() => setGalleryProduct(null)}
      />

      {/* ── More drawer ── */}
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={id => { setMoreOpen(false); setTab(id) }}
        onLogout={logout}
      />

      <div className="min-h-screen bg-gray-950 text-white">
        {/* ── Header ── */}
        <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40">
          <div className="px-4 h-12 flex items-center justify-between">
            <span className="text-white font-mono text-sm tracking-widest uppercase">JAYL Admin</span>
            {/* Desktop nav (hidden on mobile) */}
            <nav className="hidden md:flex gap-0.5">
              {[
                { id: 'home',      label: 'Home' },
                { id: 'products',  label: 'Products' },
                { id: 'generate',  label: '✦ Generate' },
                { id: 'reviews',   label: `Reviews${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
                { id: 'revenue',   label: '📊 Revenue' },
                { id: 'batch',     label: '⚡ Batch' },
                { id: 'seo-audit', label: '🔍 SEO' },
                { id: 'queue',     label: '📅 Queue' },
                { id: 'add',       label: 'Add' },
                { id: 'collections', label: 'Collections' },
                { id: 'personas',  label: 'Personas' },
                { id: 'orders',    label: 'Orders' },
                { id: 'settings',  label: 'Settings' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    tab === t.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </nav>
            <button onClick={logout} className="hidden md:block text-gray-600 hover:text-gray-400 text-xs transition-colors">
              Logout
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="pb-20 md:pb-8 md:max-w-6xl md:mx-auto md:px-6 md:py-8">
          {/* Tab title for non-home screens */}
          {tab !== 'home' && (
            <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-3 md:hidden">
              <button onClick={() => setTab('home')} className="text-gray-500 text-lg leading-none">‹</button>
              <h2 className="text-white text-sm font-medium capitalize">
                {tab === 'generate'    ? '✦ Quick Generate'
                 : tab === 'products'  ? 'Products'
                 : tab === 'reviews'   ? 'Reviews'
                 : tab === 'revenue'   ? '📊 Revenue'
                 : tab === 'batch'     ? '⚡ Batch Agent'
                 : tab === 'seo-audit' ? '🔍 SEO Audit'
                 : tab === 'queue'     ? '📅 Content Queue'
                 : tab === 'add'       ? 'Add Product'
                 : tab === 'collections' ? 'Collections'
                 : tab === 'personas'  ? 'Personas'
                 : tab === 'orders'    ? 'Orders'
                 : tab === 'settings'  ? 'Settings'
                 : tab}
              </h2>
            </div>
          )}

          {tab === 'home'        && <HomeTab onNavigate={navigate} onGenerate={handleGenerate} />}
          {tab === 'products'    && (
            <div className="px-4 pt-4">
              <ProductsTab onEdit={handleEdit} onGenerate={handleGenerate} onGallery={handleGallery} />
            </div>
          )}
          {tab === 'generate'    && <GenerateTab onGenerate={handleGenerate} onGallery={handleGallery} />}
          {tab === 'revenue'     && <RevenueTab />}
          {tab === 'batch'       && <BatchAgentTab />}
          {tab === 'seo-audit'   && <SeoAuditTab />}
          {tab === 'queue'       && <ContentQueueTab />}
          {tab === 'reviews'     && (
            <div className="px-4 pt-4">
              <ReviewsTab />
            </div>
          )}
          {tab === 'add'         && (
            <div className="px-4 pt-4">
              <AddProductTab onSaved={() => setTab('products')} />
            </div>
          )}
          {tab === 'collections' && (
            <div className="px-4 pt-4">
              <CollectionsTab />
            </div>
          )}
          {tab === 'personas'    && (
            <div className="px-4 pt-4">
              <PersonasTab />
            </div>
          )}
          {tab === 'orders'      && (
            <div className="px-4 pt-4">
              <OrdersTab />
            </div>
          )}
          {tab === 'settings'    && (
            <div className="px-4 pt-4">
              <SettingsTab />
            </div>
          )}
        </main>

        {/* ── Mobile bottom nav ── */}
        <div className="md:hidden">
          <BottomNav
            active={tab}
            onNavigate={navigate}
            pendingCount={pendingCount}
          />
        </div>
      </div>
    </>
  )
}
