import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { products as allProducts } from '@/data/products'
import GenerateAssetsTab from '@/components/GenerateAssetsTab'

const ADMIN_PASSWORD = 'jaylpelle'

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const fmt = cents => `€${(cents / 100).toFixed(2)}`
const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

function parseVideoUrl(url) {
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

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnDanger  = 'bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors cursor-pointer'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-gray-500 text-xs mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-gray-600 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      {title && (
        <p className="text-gray-600 text-xs font-mono uppercase tracking-widest border-b border-gray-800 pb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

// ── Image Gallery (left column) ───────────────────────────────────────────────

function ImageGallery({ productId, readOnly }) {
  const [images, setImages]     = useState([])
  const [active, setActive]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const data = await api('list-images', { productId })
      const imgs = data.images || []
      setImages(imgs)
      setActive(0)
    } catch (e) {
      // silently fail — product may have no images folder yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [productId])

  const addFiles = useCallback(async files => {
    if (readOnly) return
    setUploading(true); setError('')
    try {
      for (const file of Array.from(files)) {
        const dataUrl  = await fileToBase64(file)
        const filename = sanitizeFilename(file.name)
        await api('upload-image', { productId, filename, dataUrl })
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }, [productId, readOnly])

  const handleDelete = async img => {
    if (!confirm(`Delete ${img.name}?`)) return
    setError('')
    try {
      await api('delete-image', { path: img.path, sha: img.sha })
      setImages(prev => {
        const next = prev.filter(i => i.sha !== img.sha)
        setActive(a => Math.min(a, next.length - 1))
        return next
      })
    } catch (e) {
      setError(e.message)
    }
  }

  const current = images[active]

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-[4/5] bg-gray-900 border border-gray-800 overflow-hidden flex items-center justify-center relative group">
        {loading ? (
          <p className="text-gray-600 text-sm">Loading…</p>
        ) : current ? (
          <>
            <img src={current.url} alt={current.name} className="w-full h-full object-cover" />
            {!readOnly && (
              <button
                onClick={() => handleDelete(current)}
                className="absolute top-2 right-2 bg-red-700 hover:bg-red-600 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete image
              </button>
            )}
          </>
        ) : (
          <p className="text-gray-700 text-sm">No images yet</p>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {images.map((img, i) => (
            <button
              key={img.sha}
              onClick={() => setActive(i)}
              className={`w-16 h-16 flex-shrink-0 border-2 overflow-hidden transition-all ${
                i === active ? 'border-indigo-500' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover"
                onError={e => { e.currentTarget.style.opacity = '0.3' }} />
            </button>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {!readOnly && (
        <>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
              dragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            {uploading
              ? <p className="text-indigo-400 text-xs">Uploading to GitHub…</p>
              : <p className="text-gray-600 text-xs">Drop images or click to upload</p>
            }
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => addFiles(e.target.files)} />
          </div>
          <p className="text-gray-700 text-xs">{images.length} image{images.length !== 1 ? 's' : ''} in GitHub</p>
        </>
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

// ── Main page ─────────────────────────────────────────────────────────────────

const knownCollections = [...new Set(allProducts.map(p => p.collection).filter(Boolean))]

export default function AdminProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Auth check
  const authed = sessionStorage.getItem('adminAuth') === '1'
  useEffect(() => {
    if (!authed) navigate('/admin', { replace: true })
  }, [authed])

  // Product state
  const [product, setProduct]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const isEditable = product?.adminManaged === true

  // Form state
  const [name, setName]             = useState('')
  const [price, setPrice]           = useState('')
  const [section, setSection]       = useState('objects')
  const [collection, setCollection] = useState('')
  const [movement, setMovement]     = useState('')
  const [description, setDescription] = useState('')
  const [altText, setAltText]       = useState('')
  const [tags, setTags]             = useState('')
  const [videoUrl, setVideoUrl]     = useState('')
  const [gelatoUid, setGelatoUid]   = useState('')
  const [featured, setFeatured]     = useState(false)

  // Status
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [saveErr, setSaveErr]       = useState('')
  const [deleting, setDeleting]     = useState(false)

  // AI generation
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr]         = useState('')

  // Load product
  useEffect(() => {
    const staticP = allProducts.find(p => p.id === id)

    const populate = p => {
      setProduct(p)
      setName(p.name || '')
      setPrice(p.price != null ? (p.price / 100).toString() : '')
      setSection(p.section || 'objects')
      setCollection(p.collection || '')
      setMovement(p.movement || '')
      setDescription(p.description || '')
      setAltText(p.altText || '')
      setTags(Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''))
      setVideoUrl(p.videoUrl || '')
      setGelatoUid(p.gelatoProductId || '')
      setFeatured(!!p.featured)
    }

    if (staticP?.adminManaged) {
      // Fetch latest from GitHub
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { populate(staticP); setLoading(false) })
    } else if (staticP) {
      populate(staticP)
      setLoading(false)
    } else {
      // Might be a new product not yet in build
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { setNotFound(true); setLoading(false) })
    }
  }, [id])

  const videoInfo = parseVideoUrl(videoUrl)

  const generateWithAI = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGenerating(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      if (data.seoTitle)    setName(data.seoTitle)
      if (data.description) setDescription(data.description)
      if (data.altText)     setAltText(data.altText)
      if (data.tags?.length) setTags(data.tags.join(', '))
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return setSaveErr('Name is required')
    if (!price)       return setSaveErr('Price is required')
    setSaving(true); setSaveErr(''); setSaveMsg('')
    try {
      const priceCents = Math.round(parseFloat(price) * 100)
      const updated = {
        ...product,
        name: name.trim(),
        price: priceCents,
        section,
        collection,
        subtitle: collection,
        movement,
        description: description.trim(),
        altText: altText.trim(),
        tags: tags.trim()
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : product.tags || [],
        featured,
        gelatoProductId: gelatoUid.trim() || null,
        adminManaged: true,
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : { videoUrl: undefined }),
      }
      // Clean undefined keys
      Object.keys(updated).forEach(k => updated[k] === undefined && delete updated[k])

      await api('save-product', { product: updated })
      setProduct(updated)
      setSaveMsg('✓ Saved — Vercel will redeploy automatically.')
      setTimeout(() => setSaveMsg(''), 4000)
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api('delete-product', { productId: id })
      navigate('/admin', { replace: true })
    } catch (e) {
      setSaveErr(e.message)
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!authed) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading product…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Product <span className="font-mono text-white">{id}</span> not found.</p>
        <Link to="/admin" className={btnGhost}>← Back to Products</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Sticky header ── */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-13 flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/admin"
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              ← Products
            </Link>
            <span className="text-gray-700 flex-shrink-0">·</span>
            <span className="font-mono text-xs text-gray-400 truncate">{id}</span>
            {isEditable
              ? <span className="bg-indigo-900/50 border border-indigo-800 text-indigo-300 text-xs px-2 py-0.5 flex-shrink-0">admin-managed</span>
              : <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 flex-shrink-0">hardcoded</span>
            }
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View on site */}
            <a
              href={`/product/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              🌐 View on site
            </a>

            {isEditable && (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-5 py-2 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        {(saveMsg || saveErr) && (
          <div className={`px-6 py-2 text-xs ${saveMsg ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {saveMsg || saveErr}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isEditable && (
          <div className="mb-6 bg-amber-900/20 border border-amber-800 px-4 py-3 text-amber-300 text-sm">
            This product is hardcoded in <span className="font-mono">src/data/products.js</span> and cannot be edited here. Fields are shown read-only.
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* ── Left: image gallery ── */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <ImageGallery productId={id} readOnly={!isEditable} />

            {/* Quick stats */}
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Current price</span>
                <span className="text-gray-300">{product.price != null ? fmt(product.price) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Section</span>
                <span className="text-gray-300">{product.section || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Collection</span>
                <span className="text-gray-300">{product.collection || '—'}</span>
              </div>
              {product.gelatoProductId && (
                <div className="flex justify-between">
                  <span>Gelato UID</span>
                  <span className="text-gray-400 font-mono truncate max-w-[140px]">{product.gelatoProductId}</span>
                </div>
              )}
              {product.videoUrl && (
                <div className="flex justify-between">
                  <span>Video</span>
                  <span className="text-indigo-400">▶ linked</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: edit form ── */}
          <div className="space-y-8">

            {/* ── Name + AI ── */}
            <Section title="Title">
              <Field label="Product name" hint={`id: ${id}`}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isEditable}
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>
              {isEditable && (
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={generateWithAI}
                    disabled={generating || !name.trim()}
                    className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    {generating ? (
                      <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Generating…</>
                    ) : (
                      <>✨ Regenerate with AI</>
                    )}
                  </button>
                  {genErr && <span className="text-red-400 text-xs">{genErr}</span>}
                  {!genErr && !generating && altText && description && (
                    <span className="text-violet-400 text-xs">✓ AI content applied</span>
                  )}
                </div>
              )}
            </Section>

            {/* ── Pricing & meta ── */}
            <Section title="Pricing & Categorisation">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price (€)">
                  <input
                    type="number" min="0" step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>

                <Field label="Section">
                  <select
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    <option value="objects">objects</option>
                    <option value="art">art</option>
                  </select>
                </Field>

                <Field label="Collection">
                  <input
                    value={collection}
                    onChange={e => setCollection(e.target.value)}
                    disabled={!isEditable}
                    list="known-collections"
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                  <datalist id="known-collections">
                    {knownCollections.map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>

                <Field label="Movement / Style">
                  <input
                    value={movement}
                    onChange={e => setMovement(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>
              </div>

              {isEditable && (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={e => setFeatured(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">Featured product (shown on homepage)</span>
                </label>
              )}
            </Section>

            {/* ── Description ── */}
            <Section title="Copy">
              <Field label="Description" hint="~150 words · shown in the About accordion on the product page">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isEditable}
                  rows={6}
                  className={`${inputCls} resize-y${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>

              <Field label="Alt text" hint="1 sentence · shown to screen readers and used for SEO image indexing">
                <input
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Snorlax fan art t-shirt on white background…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              <Field
                label="Tags"
                hint={`${tags.split(',').filter(t => t.trim()).length}/13 tags · comma-separated · each max 20 chars`}
              >
                <textarea
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  placeholder="snorlax shirt, pokemon gift, anime tee, …"
                  className={`${inputCls} resize-none${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>
            </Section>

            {/* ── Video ── */}
            <Section title="Video">
              <Field label="Video URL" hint="YouTube, Vimeo, or direct .mp4 — shown as hero on the product page">
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  disabled={!isEditable}
                  placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              {videoInfo?.type === 'youtube' && (
                <div className="relative w-48 mt-2">
                  <img
                    src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full border border-gray-700"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-white text-3xl">▶</span>
                  </div>
                </div>
              )}
              {videoInfo?.type === 'vimeo' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  ▶ Vimeo · {videoInfo.id}
                </p>
              )}
              {videoInfo?.type === 'mp4' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  MP4 video linked
                </p>
              )}
              {videoUrl && !videoInfo && (
                <p className="text-yellow-500 text-xs mt-1">⚠ URL not recognised as YouTube, Vimeo, or .mp4</p>
              )}
            </Section>

            {/* ── Gelato ── */}
            <Section title="Gelato">
              <Field label="Gelato Product UID" hint="Used to route orders to the correct Gelato product">
                <input
                  value={gelatoUid}
                  onChange={e => setGelatoUid(e.target.value.replace(/[^\x20-\x7E]/g, '').trim())}
                  disabled={!isEditable}
                  className={`${inputCls} font-mono text-xs${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>

              {/* Sizes read-only */}
              {product.sizes?.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Sizes</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(s => (
                      <span key={s.id} className="border border-gray-700 text-gray-400 text-xs px-3 py-1">
                        {s.label} · {fmt(s.price)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants read-only */}
              {product.variants?.length > 0 && (
                <Collapsible label={`${product.variants.length} variant${product.variants.length !== 1 ? 's' : ''}`} defaultOpen={false}>
                  <div className="overflow-x-auto scrollbar-hide max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-gray-600 border-b border-gray-800">
                          <th className="pb-1.5 pr-3">Color</th>
                          <th className="pb-1.5 pr-3">Size</th>
                          <th className="pb-1.5">Gelato variant UID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v, i) => (
                          <tr key={i} className="border-b border-gray-800/40 text-gray-400">
                            <td className="py-1 pr-3">{v.color || v.id || '—'}</td>
                            <td className="py-1 pr-3">{v.size || '—'}</td>
                            <td className="py-1 font-mono text-gray-600 text-xs truncate max-w-xs">
                              {v.gelatoVariantId || v.uid || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Collapsible>
              )}
            </Section>

            {/* ── Save (bottom) ── */}
            {isEditable && (
              <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-8 py-3 text-sm font-semibold transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete Product'}
                </button>
                {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
                {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
              </div>
            )}

            {/* ── Generate Assets ── */}
            <GenerateAssetsTab
              productId={id}
              productName={name}
              productType={section === 'art' ? 'art print' : 'apparel/object'}
              primaryColor={product?.variants?.[0]?.color || ''}
              collection={collection}
              onAssetSaved={() => {}}
            />

          </div>
        </div>
      </div>
    </div>
  )
}
