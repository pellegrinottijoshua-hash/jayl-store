import { useState, useCallback, useRef, useEffect } from 'react'
import { products as allProducts } from '@/data/products'

const ADMIN_PASSWORD = 'jaylpelle'

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const fmt = cents => `€${(cents / 100).toFixed(2)}`
const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

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

  const [title, setTitle]           = useState(editingProduct?.name || '')
  const [price, setPrice]           = useState(editingProduct ? (editingProduct.price / 100).toString() : '')
  const [section, setSection]       = useState(editingProduct?.section || 'objects')
  const [collection, setCollection] = useState(editingProduct?.collection || '')
  const [newColl, setNewColl]       = useState('')
  const [movement, setMovement]     = useState(editingProduct?.movement || '')
  const [description, setDescription] = useState(editingProduct?.description || '')

  const [images, setImages]         = useState([])
  const [saving, setSaving]         = useState(false)
  const [saveErr, setSaveErr]       = useState('')
  const [savedMsg, setSavedMsg]     = useState('')

  const productId = isEdit ? editingProduct.id : slugify(title)
  const finalCollection = newColl.trim() || collection

  const fetchVariants = async () => {
    if (!gelatoUid.trim()) return
    setFetching(true); setFetchErr('')
    try {
      const res = await fetch(`/api/get-product-variants?productId=${encodeURIComponent(gelatoUid.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fetch failed')
      setVariants(data.variants || [])
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
      // 1. Upload new images
      const existingImages = isEdit ? (editingProduct.images || []) : []
      const uploadedPaths  = [...existingImages]
      for (const file of images) {
        const dataUrl  = await fileToBase64(file)
        const filename = sanitizeFilename(file.name)
        const result   = await api('upload-image', { productId, filename, dataUrl })
        uploadedPaths.push(result.path)
      }

      // 2. Derive sizes from variants or use default
      const uniqueSizes = [...new Set(variants.map(v => v.size).filter(Boolean))]
      const priceCents  = Math.round(parseFloat(price) * 100)
      const sizes = uniqueSizes.length > 0
        ? uniqueSizes.map(s => ({ id: s, label: s, price: priceCents }))
        : [{ id: 'one-size', label: 'One Size', price: priceCents }]

      // 3. Build product object
      const product = {
        id: productId,
        section,
        collection: finalCollection,
        name: title.trim(),
        subtitle: finalCollection,
        price: priceCents,
        currency: 'eur',
        description: description.trim() || `${title.trim()} from the ${finalCollection} collection.`,
        details: ['Printed and fulfilled via Gelato'],
        sizes,
        image: uploadedPaths[0] || '',
        images: uploadedPaths,
        tags: [slugify(title), slugify(finalCollection)].filter(Boolean),
        featured: false,
        gelatoProductId: gelatoUid.trim() || null,
        movement: movement.trim() || finalCollection,
        adminManaged: true,
        ...(variants.length > 0 ? { variants } : {}),
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
    <div className="space-y-5 max-w-3xl">
      {isEdit && (
        <div className="flex items-center justify-between bg-indigo-900/30 border border-indigo-800 px-4 py-2">
          <span className="text-indigo-300 text-sm">Editing: <span className="font-mono">{editingProduct.id}</span></span>
          <button onClick={onCancel} className={btnGhost}>Cancel</button>
        </div>
      )}

      {/* Gelato */}
      <Card title="Gelato Variants">
        <div className="flex gap-2">
          <input value={gelatoUid} onChange={e => setGelatoUid(e.target.value)}
            placeholder="Gelato Product UID or store product UUID"
            className={inputCls + ' font-mono text-xs'} />
          <button onClick={fetchVariants} disabled={fetching || !gelatoUid.trim()} className={btnPrimary + ' whitespace-nowrap'}>
            {fetching ? 'Fetching…' : 'Fetch Variants'}
          </button>
        </div>
        {fetchErr && <p className="text-red-400 text-xs">{fetchErr}</p>}
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

      {/* Info */}
      <Card title="Product Info">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" hint={title ? `id: ${slugify(title)}` : ''} >
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Snorlax T-Shirt" className={`${inputCls} col-span-2`} />
          </Field>
          <div className="col-span-2" />

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

          <Field label="Movement" >
            <input value={movement} onChange={e => setMovement(e.target.value)}
              placeholder="Pokemon Cool Logos" className={inputCls} />
          </Field>

          <div className="col-span-2">
            <Field label="Description">
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} placeholder="Product description…"
                className={`${inputCls} resize-none`} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Images */}
      <Card title="Images">
        {isEdit && editingProduct.images?.length > 0 && (
          <div>
            <p className="text-gray-500 text-xs mb-2">Current images ({editingProduct.images.length})</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {editingProduct.images.map((src, i) => (
                <img key={i} src={src} alt="" className="w-20 h-20 object-cover border border-gray-700"
                  onError={e => { e.target.style.display = 'none' }} />
              ))}
            </div>
          </div>
        )}
        <p className="text-gray-500 text-xs">{isEdit ? 'Append more images:' : 'Upload images:'}</p>
        <ImageUploader files={images} onChange={setImages} />
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
              {['ID', 'Name', 'Price', 'Section', 'Collection', 'Images', ''].map(h => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(p => (
              <tr key={p.id} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{p.id}</td>
                <td className="px-4 py-3 text-gray-100 whitespace-nowrap">{p.name}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(p.price)}</td>
                <td className="px-4 py-3 text-gray-400">{p.section}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{p.collection}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.images?.length || 0}</td>
                <td className="px-4 py-3">
                  {p.adminManaged ? (
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(p)} className={btnGhost}>Edit</button>
                      <button onClick={() => handleDelete(p)} disabled={deletingId === p.id} className={btnDanger}>
                        {deletingId === p.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-700 text-xs">hardcoded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-600 text-xs">{visible.length} products · admin-managed products can be edited/deleted</p>
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
  const [authed, setAuthed]             = useState(() => sessionStorage.getItem('adminAuth') === '1')
  const [tab, setTab]                   = useState('products')
  const [editingProduct, setEditingProduct] = useState(null)

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const handleEdit = product => { setEditingProduct(product); setTab('add') }
  const handleSaved = () => { setEditingProduct(null); setTab('products') }
  const handleCancelEdit = () => { setEditingProduct(null); setTab('products') }
  const logout = () => { sessionStorage.removeItem('adminAuth'); setAuthed(false) }

  const tabs = [
    { id: 'products', label: 'Products' },
    { id: 'add',      label: editingProduct ? `Edit: ${editingProduct.id}` : 'Add Product' },
    { id: 'images',   label: 'Images' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-white font-semibold text-sm tracking-wide">JAYL Admin</span>
            <nav className="flex gap-0.5">
              {tabs.map(t => (
                <button key={t.id}
                  onClick={() => { setTab(t.id); if (t.id !== 'add') setEditingProduct(null) }}
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
        {tab === 'products' && <ProductsTab onEdit={handleEdit} />}
        {tab === 'add' && (
          <AddProductTab
            editingProduct={editingProduct}
            onSaved={handleSaved}
            onCancel={handleCancelEdit}
          />
        )}
        {tab === 'images' && <ImagesTab />}
      </main>
    </div>
  )
}
