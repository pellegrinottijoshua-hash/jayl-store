import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { products as allProducts } from '@/data/products'

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

  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr]         = useState('')

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
      if (data.seoTitle)    setTitle(data.seoTitle)
      if (data.description) setDescription(data.description)
      if (data.altText)     setAltText(data.altText)
      if (data.tags?.length) setTags(data.tags.join(', '))
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
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
        ...(variants.length > 0 ? { variants } : {}),
        ...(colorsArray ? { colors: colorsArray } : {}),
      }

      await api('save-product', { product })
      setSavedMsg(`✓ ${isEdit ? 'Updated' : 'Added'}! Vercel deploy will trigger automatically.`)
      setImages([])
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
        )}

        {variants.length > 0 && (
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
        )}
      </Card>

      {/* Gelato Mockup Images — auto-imported on fetch */}
      {(gelatoImages.length > 0 || importing || importMsg) && (
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

          {/* Images grouped by color — show imported paths (GitHub) not S3 URLs */}
          {importedPaths.length > 0 && (
            Object.keys(imagesByColor).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(imagesByColor).map(([color, srcs]) => (
                  <div key={color}>
                    {color !== '__all__' && (
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{color}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {srcs.map((src, i) => {
                        const idx = gelatoImages.findIndex(g => g.src === src)
                        const path = importedPaths[idx] ?? null
                        return (
                          <div key={i} className="relative flex-shrink-0 w-20">
                            {path ? (
                              <div className="w-20 h-20 border border-green-600 bg-gray-800 flex flex-col items-center justify-center gap-1 p-1">
                                <span className="text-green-400 text-base">✓</span>
                                <span className="text-gray-400 text-xs text-center break-all leading-tight">{path.split('/').pop()}</span>
                              </div>
                            ) : (
                              <div className="w-20 h-20 border border-gray-700 bg-gray-800 flex items-center justify-center">
                                <span className="text-gray-600 text-xs">—</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {importedPaths.map((path, i) => (
                  <div key={i} className="w-20 h-20 border border-green-600 bg-gray-800 flex flex-col items-center justify-center gap-1 p-1">
                    <span className="text-green-400 text-base">✓</span>
                    <span className="text-gray-400 text-xs text-center break-all leading-tight">{path.split('/').pop()}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {importedPaths.length > 0 && (
            <p className="text-gray-600 text-xs">Le immagini saranno visibili sul sito dopo il deploy Vercel (~2 min).</p>
          )}
        </Card>
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
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-6 py-2.5 text-sm font-semibold transition-colors">
          {saving ? 'Saving…' : isEdit ? 'Update Product' : 'Add to Site'}
        </button>
        {savedMsg && <span className="text-green-400 text-sm">{savedMsg}</span>}
        {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
      </div>
    </div>
  )
}

// ── Product List Tab ──────────────────────────────────────────────────────────

function ProductsTab({ onEdit }) {
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError]           = useState('')
  const [hidden, setHidden]         = useState([])

  const visible = allProducts.filter(p => !hidden.includes(p.id))

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

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-900/20 border border-red-800 px-4 py-2 text-red-400 text-sm">{error}</div>
      )}
      <div className="bg-gray-900 border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs font-mono uppercase tracking-wider">
              {['ID', 'Name', 'Price', 'Section', 'Collection', 'Video', 'Images', ''].map(h => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(p => (
              <tr
                key={p.id}
                onClick={() => navigate(`/admin/product/${p.id}`)}
                className="border-b border-gray-800/40 hover:bg-gray-800/50 transition-colors cursor-pointer"
              >
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
                        {deletingId === p.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => navigate(`/admin/product/${p.id}`)} className={btnGhost}>View</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 text-xs">{visible.length} products · click any row to open the product editor</p>
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
        </main>
      </div>
    </>
  )
}
