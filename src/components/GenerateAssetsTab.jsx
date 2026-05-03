import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePrompts as defaultPromptsStatic } from '@/data/generate-prompts'

const ADMIN_PASSWORD = 'jaylpelle'

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

const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors cursor-pointer'

// ── Model lists ───────────────────────────────────────────────────────────────

export const IMAGE_MODELS = [
  { id: 'fal-ai/flux/schnell',  label: 'Flux Schnell',  cost: '$0.003/img', badge: '⚡ Free-tier' },
  { id: 'fal-ai/flux-pro/v1.1', label: 'Flux Pro 1.1',  cost: '$0.04/img'  },
  { id: 'fal-ai/ideogram/v3',   label: 'Ideogram V3',   cost: '$0.08/img',  badge: '✏ Best text' },
  { id: 'fal-ai/nano-banana-2', label: 'Nano Banana 2', cost: '$0.08/img'  },
  { id: 'fal-ai/recraft-v3',    label: 'Recraft V3',    cost: '$0.04/img',  badge: '🎨 Design'   },
]

export const VIDEO_MODELS = [
  { id: 'fal-ai/ltx-video',                                 label: 'LTX Video',        secRate: 0.002, badge: '⚡ Free-tier' },
  { id: 'fal-ai/wan/v2.2/t2v',                              label: 'Wan 2.2',          secRate: 0.05  },
  { id: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video', label: 'Seedance 1.5 Pro', secRate: 0.052 },
  { id: 'fal-ai/kling-video/v1.6/standard/text-to-video',   label: 'Kling 1.6 Std',   secRate: 0.084 },
  { id: 'fal-ai/kling-video/v3/pro/text-to-video',          label: 'Kling 3.0 Pro',   secRate: 0.224 },
]

// Map text-to-video IDs → image-to-video IDs for fal.ai
const T2V_TO_I2V = {
  'fal-ai/ltx-video':                                 'fal-ai/ltx-video/image-to-video',
  'fal-ai/wan/v2.2/t2v':                              'fal-ai/wan/v2.2/i2v',
  'fal-ai/bytedance/seedance/v1.5/pro/text-to-video': 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  'fal-ai/kling-video/v1.6/standard/text-to-video':   'fal-ai/kling-video/v1.6/standard/image-to-video',
  'fal-ai/kling-video/v3/pro/text-to-video':          'fal-ai/kling-video/v3/pro/image-to-video',
}

const IMAGE_SIZES = [
  { id: 'square_hd',      label: '1:1',  desc: '1024×1024' },
  { id: 'portrait_16_9',  label: '9:16', desc: '576×1024'  },
  { id: 'landscape_16_9', label: '16:9', desc: '1024×576'  },
  { id: 'portrait_4_3',   label: '3:4',  desc: '768×1024'  },
  { id: 'landscape_4_3',  label: '4:3',  desc: '1024×768'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const subVars = (tmpl, vars) =>
  (tmpl || '')
    .replace(/\{PRODUCT_NAME\}/g,  vars.name       || 'this product')
    .replace(/\{PRODUCT_TYPE\}/g,  vars.type       || 'product')
    .replace(/\{COLOR\}/g,         vars.color      || 'default color')
    .replace(/\{COLLECTION\}/g,    vars.collection || '')

// Convert relative /images/... path to absolute URL for fal.ai (passes through if already absolute)
const toAbsoluteUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${window.location.origin}${url}`
}

async function downloadAsset(url, filename) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch {
    window.open(url, '_blank')
  }
}

// ── PromptCard (module-level — never define inside another component) ─────────
// images: [{ url, name }] — all available reference images (absolute or relative)
// selectedImage: { url, name } | null
// onSelectImage: (img) => void

function PromptCard({
  template, isVideo, promptText, onPromptChange,
  result, onGenerate, onSave, onSavePrompt, savingPrompt, savedPromptMsg,
  images, selectedImage, onSelectImage,
}) {
  const r    = result || {}
  const busy = r.status === 'generating' || r.status === 'submitting' || r.status === 'processing'

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">{template.name}</p>
        {savedPromptMsg && (
          <span className={`text-xs flex-shrink-0 ${savedPromptMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>
            {savedPromptMsg}
          </span>
        )}
      </div>

      {/* Per-prompt image selector (compact horizontal strip) */}
      {images.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
          {images.map((img, i) => {
            const isSelected = selectedImage
              ? selectedImage.url === img.url
              : i === 0   // first image is default
            return (
              <button
                key={img.url || i}
                onClick={() => onSelectImage(img)}
                title={img.name}
                className={`flex-shrink-0 w-12 h-12 border-2 overflow-hidden transition-all ${
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <img
                  src={toAbsoluteUrl(img.url)}
                  alt={img.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Editable textarea */}
      <textarea
        value={promptText ?? ''}
        onChange={e => onPromptChange(e.target.value)}
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 resize-none focus:outline-none focus:border-indigo-500 transition-colors font-mono"
      />

      {/* Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={busy}
          className={`${btnPrimary} text-xs py-1.5 flex items-center gap-2`}
        >
          {busy ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full flex-shrink-0" />
              {r.status === 'processing' ? `${r.progress ?? 0}%…` : r.status === 'submitting' ? 'Submitting…' : 'Generating…'}
            </>
          ) : (
            isVideo ? '🎬 Generate' : '🖼 Generate'
          )}
        </button>
        <button
          onClick={onSavePrompt}
          disabled={savingPrompt}
          className={`${btnGhost} text-xs py-1`}
          title="Save as default template"
        >
          {savingPrompt ? '…' : '💾 Save prompt'}
        </button>
      </div>

      {/* Video progress bar */}
      {isVideo && (r.status === 'submitting' || r.status === 'processing') && (
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${r.progress ?? 5}%` }}
          />
        </div>
      )}

      {/* Error */}
      {r.status === 'error' && r.error && (
        <p className="text-red-400 text-xs">⚠ {r.error}</p>
      )}

      {/* Image result */}
      {!isVideo && r.imageUrl && (
        <div className="space-y-2">
          <img
            src={r.imageUrl}
            alt="Generated"
            className="w-full border border-gray-700"
            style={{ maxHeight: 280, objectFit: 'contain', background: '#111' }}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onSave(r.imageUrl, 'image')}
              disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}
            >
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save to Product'}
            </button>
            <button onClick={() => downloadAsset(r.imageUrl, `${template.id}.jpg`)} className={`${btnGhost} text-xs py-1`}>
              ⬇ Download
            </button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
          </div>
        </div>
      )}

      {/* Video result */}
      {isVideo && r.videoUrl && (
        <div className="space-y-2">
          <video src={r.videoUrl} controls className="w-full border border-gray-700" style={{ maxHeight: 240 }} />
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => onSave(r.videoUrl, 'video')}
              disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}
            >
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save to Product'}
            </button>
            <button onClick={() => downloadAsset(r.videoUrl, `${template.id}.mp4`)} className={`${btnGhost} text-xs py-1`}>
              ⬇ Download
            </button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
            <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs underline">
              Open ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GenerateAssetsTab ─────────────────────────────────────────────────────────
// preloadedImages: [{ url, name }] — Gelato CDN images passed from parent (for Add Product flow)
//                                    Used when productImages haven't been fetched yet (e.g. new product)

export default function GenerateAssetsTab({ productId, productName, productType, primaryColor, collection, onAssetSaved, preloadedImages }) {
  const [activeTab,       setActiveTab]       = useState('mockup')
  const [rawPrompts,      setRawPrompts]      = useState(null)
  const [localPrompts,    setLocalPrompts]    = useState({})
  const [imageModel,      setImageModel]      = useState(IMAGE_MODELS[0].id)
  const [videoModel,      setVideoModel]      = useState(VIDEO_MODELS[0].id)
  const [imageSize,       setImageSize]       = useState('square_hd')
  const [videoDuration,   setVideoDuration]   = useState('5')
  const [results,         setResults]         = useState({})
  const [savingPrompts,   setSavingPrompts]   = useState({})
  const [savedPromptMsgs, setSavedPromptMsgs] = useState({})

  // ── Image sources ──────────────────────────────────────────────────────────
  // productImages: fetched from GitHub (saved images for this product)
  // allImages: productImages if available, otherwise preloadedImages (Gelato CDN)
  const [productImages, setProductImages] = useState([])  // [{ name, path, sha, url }]

  // Per-template image selection: { [templateId]: { url, name } }
  const [selectedImages, setSelectedImages] = useState({})

  const pollTimers = useRef({})

  // Merge sources: prefer fetched product images, fall back to Gelato preloads
  const normalizedPreloaded = (preloadedImages || []).map(img => ({
    url:  img.url,
    name: img.name || img.url.split('/').pop() || 'image',
  }))
  const allImages = productImages.length > 0 ? productImages : normalizedPreloaded

  // ── Load product images on mount ───────────────────────────────────────────

  useEffect(() => {
    if (!productId) return
    api('list-images', { productId })
      .then(data => {
        const imgs = (data.images || []).filter(i => !/generated\//.test(i.path))
        setProductImages(imgs)
      })
      .catch(() => {})
  }, [productId])

  // ── Prompts ────────────────────────────────────────────────────────────────

  const initPrompts = useCallback((p) => {
    const v = { name: productName, type: productType, color: primaryColor, collection }
    setRawPrompts(p)
    const local = {}
    for (const t of [...(p.mockup || []), ...(p.video || [])]) {
      local[t.id] = subVars(t.prompt, v)
    }
    setLocalPrompts(local)
  }, [productName, productType, primaryColor, collection]) // eslint-disable-line

  useEffect(() => {
    api('read-prompts', {})
      .then(data => initPrompts(data.prompts || defaultPromptsStatic))
      .catch(() => initPrompts(defaultPromptsStatic))
  }, [productId, initPrompts])

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  // ── Helper: get selected image for a template (defaults to first image) ────

  const getSelectedImage = (templateId) =>
    selectedImages[templateId] ?? allImages[0] ?? null

  // ── Image generation (img-to-img) ─────────────────────────────────────────

  const handleGenerateImage = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const imgObj  = getSelectedImage(templateId)
    const imageUrl = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    patchResult(templateId, { status: 'generating', error: null, imageUrl: null, saved: false })
    try {
      const res = await fetch('/api/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: imageModel, prompt: prompt.trim(), imageSize, imageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      patchResult(templateId, { status: 'done', imageUrl: data.imageUrl })
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Video generation (img-to-video) ───────────────────────────────────────

  const handleGenerateVideo = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const imgObj  = getSelectedImage(templateId)
    const imageUrl = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    // Always use image-to-video model variant when an image is available
    const effectiveModelId = (imageUrl && T2V_TO_I2V[videoModel]) ? T2V_TO_I2V[videoModel] : videoModel

    patchResult(templateId, { status: 'submitting', error: null, videoUrl: null, requestId: null, progress: 0, saved: false })
    try {
      const submitRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', modelId: effectiveModelId, prompt: prompt.trim(), duration: videoDuration, imageUrl }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitData.error || 'Submit failed')
      const requestId = submitData.requestId
      if (!requestId) throw new Error('No requestId in response')
      patchResult(templateId, { status: 'processing', requestId, progress: 10 })

      const poll = async () => {
        try {
          const sRes  = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', modelId: effectiveModelId, requestId }),
          })
          const sData = await sRes.json()
          const st    = sData.status
          if (st === 'COMPLETED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            const rRes  = await fetch('/api/generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'result', modelId: effectiveModelId, requestId }),
            })
            const rData = await rRes.json()
            if (!rRes.ok) throw new Error(rData.error)
            patchResult(templateId, { status: 'done', videoUrl: rData.videoUrl, progress: 100 })
          } else if (st === 'FAILED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            patchResult(templateId, { status: 'error', error: 'Generation failed on fal.ai' })
          } else {
            patchResult(templateId, { progress: st === 'IN_PROGRESS' ? 60 : 20 })
          }
        } catch (e) {
          console.warn('[video-poll]', e.message)
        }
      }
      pollTimers.current[requestId] = setInterval(poll, 3000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Save asset to product ────────────────────────────────────────────────────

  const handleSaveAsset = async (templateId, assetUrl, assetType) => {
    if (!productId || !assetUrl) return
    patchResult(templateId, { saving: true, error: null })
    try {
      const data = await api('import-generated-asset', { productId, assetUrl, assetType })
      patchResult(templateId, { saving: false, saved: true })
      if (assetType === 'image') onAssetSaved?.(data.path)
    } catch (e) {
      patchResult(templateId, { saving: false, error: e.message })
    }
  }

  // ── Save single prompt template ──────────────────────────────────────────────

  const handleSavePrompt = async (templateId, isVideoPrompt) => {
    if (!rawPrompts) return
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const category = isVideoPrompt ? 'video' : 'mockup'
      const updated = {
        ...rawPrompts,
        [category]: (rawPrompts[category] || []).map(t =>
          t.id === templateId ? { ...t, prompt: localPrompts[templateId] ?? t.prompt } : t
        ),
      }
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
      setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '✓ Saved' }))
      setTimeout(() => setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '' })), 2000)
    } catch (e) {
      setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '⚠ Error' }))
    } finally {
      setSavingPrompts(prev => ({ ...prev, [templateId]: false }))
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const prompts          = rawPrompts || defaultPromptsStatic
  const currentTemplates = activeTab === 'mockup' ? (prompts.mockup || []) : (prompts.video || [])
  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  return (
    <div className="border border-indigo-900/50 bg-gray-950">

      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800">
        <h3 className="text-indigo-400 text-xs font-mono uppercase tracking-widest">✨ Generate Assets</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { id: 'mockup',  label: '🖼 Mockup' },
          { id: 'video',   label: '🎬 Video'  },
          { id: 'publish', label: '📱 Publish', disabled: true },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setActiveTab(t.id)}
            disabled={t.disabled}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              t.disabled
                ? 'border-transparent text-gray-600 cursor-not-allowed'
                : activeTab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.disabled && <span className="ml-1 text-gray-600 text-xs">(soon)</span>}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">

        {/* Settings bar */}
        <div className="bg-gray-900 border border-gray-800 p-3 space-y-3">

          {/* Model selector */}
          <div className="flex items-center gap-3">
            <label className="text-gray-500 text-xs w-16 flex-shrink-0">Model</label>
            <select
              value={activeTab === 'mockup' ? imageModel : videoModel}
              onChange={e => activeTab === 'mockup' ? setImageModel(e.target.value) : setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-indigo-500 flex-1 min-w-0"
            >
              {(activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS).map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label} — {activeTab === 'mockup'
                    ? m.cost
                    : `$${(m.secRate * parseFloat(videoDuration)).toFixed(3)}/${videoDuration}s`}
                </option>
              ))}
            </select>
          </div>

          {/* Image size pills */}
          {activeTab === 'mockup' && (
            <div className="flex items-center gap-3">
              <label className="text-gray-500 text-xs w-16 flex-shrink-0">Size</label>
              <div className="flex gap-1 flex-wrap items-center">
                {IMAGE_SIZES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setImageSize(s.id)}
                    title={s.desc}
                    className={`px-2 py-0.5 text-xs border transition-colors ${
                      imageSize === s.id
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="text-gray-600 text-xs ml-1">
                  {IMAGE_SIZES.find(s => s.id === imageSize)?.desc}
                </span>
              </div>
            </div>
          )}

          {/* Video duration */}
          {activeTab === 'video' && (
            <div className="flex items-center gap-3">
              <label className="text-gray-500 text-xs w-16 flex-shrink-0">Duration</label>
              <div className="flex gap-1 items-center">
                {['5', '10'].map(d => (
                  <button
                    key={d}
                    onClick={() => setVideoDuration(d)}
                    className={`px-3 py-0.5 text-xs border transition-colors ${
                      videoDuration === d
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
                <span className="text-gray-600 text-xs ml-2">
                  ≈ ${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
                </span>
              </div>
            </div>
          )}

          {/* Mode indicator */}
          {allImages.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs w-16 flex-shrink-0">Mode</span>
              <span className="text-xs px-2 py-0.5 border border-indigo-700 text-indigo-300 bg-indigo-900/20">
                {activeTab === 'video' ? 'img-to-video' : 'img-to-img'}
              </span>
              <span className="text-gray-600 text-xs">Select reference per prompt below</span>
            </div>
          )}
        </div>

        {/* No images warning */}
        {allImages.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 px-4 py-3 text-yellow-400 text-xs">
            ⚠ No reference images available. Fetch &amp; import Gelato mockups first, or save the product to enable image generation.
          </div>
        )}

        {/* Prompt cards */}
        <div className="space-y-4">
          {currentTemplates.map(t => (
            <PromptCard
              key={t.id}
              template={t}
              isVideo={activeTab === 'video'}
              promptText={localPrompts[t.id] ?? ''}
              onPromptChange={val => setLocalPrompts(prev => ({ ...prev, [t.id]: val }))}
              result={results[t.id]}
              onGenerate={() => activeTab === 'video' ? handleGenerateVideo(t.id) : handleGenerateImage(t.id)}
              onSave={(url, type) => handleSaveAsset(t.id, url, type)}
              onSavePrompt={() => handleSavePrompt(t.id, activeTab === 'video')}
              savingPrompt={savingPrompts[t.id]}
              savedPromptMsg={savedPromptMsgs[t.id]}
              images={allImages}
              selectedImage={selectedImages[t.id] ?? null}
              onSelectImage={img => setSelectedImages(prev => ({ ...prev, [t.id]: img }))}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
